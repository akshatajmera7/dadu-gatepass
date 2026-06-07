import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { MOCK_PASSES } from './pass.controller';
import { MOCK_USERS } from './auth.controller';
import { encrypt, decrypt, getTOTP, checkTOTP } from '../utils/crypto';
import { broadcastGateLog } from '../socket';
import { ActionType, ScanType, PassStatus, Role } from '@prisma/client';

// Keep a local in-memory log database for fallback
export const MOCK_GATE_LOGS: any[] = [];

// Helper to get a deterministic secret for a pass if DB is down
function getMockSecretForPass(passId: string): string {
  // Just a simple deterministic key derived from passId
  return `mocksec-${passId.substring(0, 10)}`;
}

export async function generateQRPayload(req: AuthenticatedRequest, res: Response) {
  const passId = req.params.passId as string;

  try {
    // 1. Fetch pass
    const pass: any = await prisma.pass.findUnique({
      where: { id: passId },
      include: { rotatingQrSecret: true, user: true }
    });

    if (pass) {
      if (pass.status !== PassStatus.approved) {
        return res.status(400).json({ error: 'Pass is not approved' });
      }

      // Check access: only the owner can get the QR generator payload
      if (req.user!.role !== Role.admin && pass.userId !== req.user!.id) {
        console.log(`[QR Access Denied - DB Pass] req.user.role: ${req.user!.role}, pass.userId: ${pass.userId}, req.user.id: ${req.user!.id}`);
        return res.status(403).json({ error: 'Access denied' });
      }

      let secretKey = pass.rotatingQrSecret?.secretKey;
      if (!secretKey) {
        secretKey = 'defaultsecretkey12345';
      }

      const totpToken = getTOTP(secretKey);
      const data = {
        passId: pass.id,
        totp: totpToken,
        createdAt: Date.now()
      };

      const encryptedPayload = encrypt(JSON.stringify(data));
      return res.json({ payload: encryptedPayload, refreshInterval: 15 });
    }
  } catch (error) {
    console.warn('DB generate QR failed, trying mock fallback.');
  }

  // Fallback Mock Logic
  const mockPass = MOCK_PASSES.find(p => p.id === passId);
  if (mockPass) {
    if (mockPass.status !== PassStatus.approved) {
      return res.status(400).json({ error: 'Pass is not approved' });
    }
    if (req.user!.role !== Role.admin && mockPass.userId !== req.user!.id) {
      console.log(`[QR Access Denied - Mock Pass] req.user.role: ${req.user!.role}, mockPass.userId: ${mockPass.userId}, req.user.id: ${req.user!.id}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    const secretKey = getMockSecretForPass(passId);
    const totpToken = getTOTP(secretKey);
    const data = {
      passId: mockPass.id,
      totp: totpToken,
      createdAt: Date.now()
    };

    const encryptedPayload = encrypt(JSON.stringify(data));
    return res.json({ payload: encryptedPayload, refreshInterval: 15 });
  }

  return res.status(404).json({ error: 'Pass not found' });
}

export async function verifyQRPayload(req: AuthenticatedRequest, res: Response) {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Payload is required' });
  }

  try {
    // 1. Decrypt payload
    const decryptedData = JSON.parse(decrypt(payload));
    const { passId, totp, createdAt } = decryptedData;

    // Check drift - QR expires in 30 seconds to account for slight clock drifts
    if (Date.now() - createdAt > 30000) {
      return res.status(400).json({ error: 'QR Code has expired. Please refresh.' });
    }

    // 2. Fetch pass and secret key
    let pass: any = await prisma.pass.findUnique({
      where: { id: passId },
      include: { rotatingQrSecret: true, user: { include: { studentProfile: true } } }
    });

    let secretKey = '';
    let userDetails: any = null;

    if (pass) {
      secretKey = pass.rotatingQrSecret?.secretKey || 'defaultsecretkey12345';
      userDetails = pass.user;
    } else {
      // Look in Mock data
      const mockPass = MOCK_PASSES.find(p => p.id === passId);
      if (mockPass) {
        pass = mockPass;
        secretKey = getMockSecretForPass(passId);
        userDetails = mockPass.user;
      }
    }

    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    if (pass.status !== PassStatus.approved) {
      return res.status(400).json({ error: 'Pass is no longer approved' });
    }

    // 3. Verify TOTP
    const isValid = checkTOTP(totp, secretKey);
    if (!isValid) {
      // Register warning log
      const alertLog = {
        id: `log-alert-${Date.now()}`,
        passId: pass.id,
        scannerId: req.user!.id,
        scanType: ScanType.qr,
        actionType: ActionType.denied,
        timestamp: new Date(),
        notes: 'Invalid/Replayed TOTP signature.',
        pass: { passType: pass.passType },
        user: { name: userDetails?.name, studentProfile: userDetails?.studentProfile }
      };
      broadcastGateLog(alertLog);
      return res.status(400).json({ error: 'Verification failed: invalid code signature' });
    }

    // Determine entry or exit log direction based on previous logs
    let actionType: ActionType = ActionType.entry;
    try {
      const lastLog = await prisma.gateLog.findFirst({
        where: { passId: pass.id },
        orderBy: { timestamp: 'desc' }
      });
      if (lastLog && lastLog.actionType === ActionType.entry) {
        actionType = ActionType.exit;
      }
    } catch {
      // Fallback check in mock logs
      const mockLogs = MOCK_GATE_LOGS.filter(l => l.passId === pass.id);
      if (mockLogs.length > 0) {
        const lastMockLog = mockLogs[mockLogs.length - 1];
        if (lastMockLog.actionType === ActionType.entry) {
          actionType = ActionType.exit;
        }
      }
    }

    // 4. Create Entry/Exit log
    const logDetails = {
      passId: pass.id,
      scannerId: req.user!.id,
      scanType: ScanType.qr,
      actionType,
      timestamp: new Date(),
      notes: `QR scan verified successfully. Direction: ${actionType.toUpperCase()}`
    };

    let savedLog: any = null;
    try {
      savedLog = await prisma.gateLog.create({
        data: logDetails,
        include: { pass: true, scanner: true }
      });
      // Append user info for WebSocket client
      savedLog.user = userDetails;
    } catch {
      savedLog = {
        id: `log-mock-${Date.now()}`,
        ...logDetails,
        pass: { passType: pass.passType },
        user: { name: userDetails?.name, studentProfile: userDetails?.studentProfile }
      };
      MOCK_GATE_LOGS.push(savedLog);
    }

    // Broadcast live event logs
    broadcastGateLog(savedLog);

    return res.json({ success: true, actionType, log: savedLog });
  } catch (err: any) {
    return res.status(400).json({ error: 'Verification failed: decryption error', details: err.message });
  }
}

export async function simulateRFID(req: AuthenticatedRequest, res: Response) {
  const { rfidTag } = req.body;
  if (!rfidTag) {
    return res.status(400).json({ error: 'rfidTag is required' });
  }

  try {
    // 1. Find user by RFID
    let user = await prisma.user.findUnique({
      where: { rfidTag },
      include: { studentProfile: true, facultyProfile: true }
    });

    let mockMode = false;
    if (!user) {
      // Search in mock users
      const mockUser = MOCK_USERS.find(u => u.id === rfidTag || u.name.toLowerCase().includes(rfidTag.toLowerCase()));
      if (mockUser) {
        user = mockUser as any;
        mockMode = true;
      }
    }

    if (!user) {
      // Register invalid tag scan warning
      const errorLog = {
        id: `log-alert-${Date.now()}`,
        passId: null,
        scannerId: req.user!.id,
        scanType: ScanType.rfid,
        actionType: ActionType.denied,
        timestamp: new Date(),
        notes: `Unregistered RFID tag swiped: "${rfidTag}"`
      };
      broadcastGateLog(errorLog);
      return res.status(404).json({ error: 'RFID card is not registered' });
    }

    // 2. Fetch approved pass for this user
    let activePass: any = null;
    if (!mockMode) {
      activePass = await prisma.pass.findFirst({
        where: {
          userId: user.id,
          status: PassStatus.approved,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });
    } else {
      // Find in mock passes
      activePass = MOCK_PASSES.find(p => 
        p.userId === user?.id &&
        p.status === PassStatus.approved
      );
    }

    if (!activePass) {
      // Register scan denied (no active pass)
      const deniedLog = {
        id: `log-mock-${Date.now()}`,
        passId: null,
        scannerId: req.user!.id,
        scanType: ScanType.rfid,
        actionType: ActionType.denied,
        timestamp: new Date(),
        notes: `RFID swipe denied: No active approved pass found for ${user.name}`,
        user: { name: user.name, studentProfile: (user as any).studentProfile }
      };
      broadcastGateLog(deniedLog);
      return res.status(403).json({ error: `Access denied: No active pass for ${user.name}` });
    }

    // Check entry/exit toggle
    let actionType: ActionType = ActionType.entry;
    try {
      const lastLog = await prisma.gateLog.findFirst({
        where: { passId: activePass.id },
        orderBy: { timestamp: 'desc' }
      });
      if (lastLog && lastLog.actionType === ActionType.entry) {
        actionType = ActionType.exit;
      }
    } catch {
      const mockLogs = MOCK_GATE_LOGS.filter(l => l.passId === activePass.id);
      if (mockLogs.length > 0) {
        const lastMockLog = mockLogs[mockLogs.length - 1];
        if (lastMockLog.actionType === ActionType.entry) {
          actionType = ActionType.exit;
        }
      }
    }

    // Log the event
    const logDetails = {
      passId: activePass.id,
      scannerId: req.user!.id,
      scanType: ScanType.rfid,
      actionType,
      timestamp: new Date(),
      notes: `RFID card tapped successfully. Tag UID: ${rfidTag}`
    };

    let savedLog: any = null;
    try {
      savedLog = await prisma.gateLog.create({
        data: logDetails,
        include: { pass: true, scanner: true }
      });
      savedLog.user = user;
    } catch {
      savedLog = {
        id: `log-mock-${Date.now()}`,
        ...logDetails,
        pass: { passType: activePass.passType },
        user: { name: user.name, studentProfile: (user as any).studentProfile }
      };
      MOCK_GATE_LOGS.push(savedLog);
    }

    broadcastGateLog(savedLog);
    return res.json({ success: true, actionType, log: savedLog });
  } catch (error: any) {
    return res.status(500).json({ error: 'RFID verification failed', details: error.message });
  }
}

/**
 * Public QR Verification — No authentication required.
 * This is a read-only check that validates the QR token and returns pass details.
 * It does NOT create a gate log entry (that requires gate_security auth).
 * Used when someone scans the QR code with their phone's native camera.
 */
export async function publicVerifyQR(req: Request, res: Response) {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Payload is required' });
  }

  try {
    const decryptedData = JSON.parse(decrypt(payload));
    const { passId, totp, createdAt } = decryptedData;

    // Check drift — QR expires in 30 seconds
    if (Date.now() - createdAt > 30000) {
      return res.status(400).json({
        valid: false,
        error: 'QR Code has expired. The pass holder needs to refresh their QR code.'
      });
    }

    // Fetch pass and secret key
    let pass: any = null;
    let secretKey = '';
    let userDetails: any = null;

    try {
      pass = await prisma.pass.findUnique({
        where: { id: passId },
        include: { rotatingQrSecret: true, user: { include: { studentProfile: true } } }
      });

      if (pass) {
        secretKey = pass.rotatingQrSecret?.secretKey || 'defaultsecretkey12345';
        userDetails = pass.user;
      }
    } catch {
      // DB failed, try mock
    }

    if (!pass) {
      const mockPass = MOCK_PASSES.find(p => p.id === passId);
      if (mockPass) {
        pass = mockPass;
        secretKey = getMockSecretForPass(passId);
        userDetails = mockPass.user;
      }
    }

    if (!pass) {
      return res.status(404).json({ valid: false, error: 'Pass not found' });
    }

    if (pass.status !== PassStatus.approved) {
      return res.status(400).json({ valid: false, error: 'Pass is no longer approved' });
    }

    // Verify TOTP
    const isValid = checkTOTP(totp, secretKey);
    if (!isValid) {
      return res.status(400).json({ valid: false, error: 'Invalid QR code signature — possible screenshot or expired token' });
    }

    // Return pass details without creating a log
    return res.json({
      valid: true,
      pass: {
        id: pass.id,
        passType: pass.passType,
        status: pass.status,
        startDate: pass.startDate,
        endDate: pass.endDate,
        passDetails: pass.passDetails || (pass as any).passDetails,
      },
      user: {
        name: userDetails?.name,
        role: userDetails?.role,
        studentProfile: userDetails?.studentProfile,
      }
    });
  } catch (err: any) {
    return res.status(400).json({ valid: false, error: 'Verification failed: could not decrypt QR code', details: err.message });
  }
}
