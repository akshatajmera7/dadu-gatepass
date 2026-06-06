import { Request, Response } from 'express';
import prisma from '../config/db';
import { MOCK_USERS } from './auth.controller';
import { LogDirection } from '@prisma/client';

export const MOCK_SWD_LOGS: any[] = [];

// Middleware to authenticate SWD requests
export function authenticateSWD(req: Request, res: Response, next: any) {
  const apiKey = Array.isArray(req.headers['x-api-key']) ? req.headers['x-api-key'][0] : req.headers['x-api-key'];
  const configuredKey = process.env.SWD_API_KEY || 'swd-secret-api-key-abcde';

  if (!apiKey || apiKey !== configuredKey) {
    return res.status(401).json({ error: 'Unauthorized SWD Integration Access: invalid API key' });
  }
  next();
}

export async function getStudentByRollNumber(req: Request, res: Response) {
  const rollNumber = req.params.rollNumber as string;

  // Log incoming SWD requests
  const logDetails = {
    endpoint: `/api/v1/integration/swd/student/${rollNumber}`,
    direction: LogDirection.inbound,
    payload: { rollNumber },
    statusCode: 200,
    timestamp: new Date()
  };

  try {
    const student = await prisma.studentProfile.findUnique({
      where: { rollNumber },
      include: { user: true }
    });

    if (student) {
      await prisma.swdIntegrationLog.create({ data: logDetails });
      return res.json({ student });
    }
  } catch {
    // Fail to mock
  }

  // Mock Lookup Fallback
  const mockUser: any = MOCK_USERS.find(u => u.studentProfile?.rollNumber === rollNumber);
  if (mockUser) {
    MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
    return res.json({
      student: {
        id: `profile-${mockUser.id}`,
        userId: mockUser.id,
        rollNumber: mockUser.studentProfile.rollNumber,
        hostelName: mockUser.studentProfile.hostelName,
        roomNumber: mockUser.studentProfile.roomNumber,
        parentPhone: mockUser.studentProfile.parentPhone,
        isBlacklisted: mockUser.studentProfile.isBlacklisted,
        user: {
          name: mockUser.name,
          email: mockUser.email,
          phone: mockUser.phone
        }
      }
    });
  }

  logDetails.statusCode = 404;
  MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
  return res.status(404).json({ error: 'Student roll number not found' });
}

export async function syncStudentStatus(req: Request, res: Response) {
  const rollNumber = req.body.rollNumber as string;
  const isBlacklisted = req.body.isBlacklisted as boolean;
  if (!rollNumber || isBlacklisted === undefined) {
    return res.status(400).json({ error: 'rollNumber and isBlacklisted (boolean) are required' });
  }

  const logDetails = {
    endpoint: `/api/v1/integration/swd/sync-status`,
    direction: LogDirection.inbound,
    payload: req.body,
    statusCode: 200,
    timestamp: new Date()
  };

  try {
    const student = await prisma.studentProfile.update({
      where: { rollNumber },
      data: { isBlacklisted },
      include: { user: true }
    });
    
    await prisma.swdIntegrationLog.create({ data: logDetails });
    return res.json({ success: true, message: `Status synchronized for ${rollNumber}`, student });
  } catch {
    // Fail to mock
  }

  // Mock sync status
  const mockUser: any = MOCK_USERS.find(u => u.studentProfile?.rollNumber === rollNumber);
  if (mockUser) {
    mockUser.studentProfile.isBlacklisted = isBlacklisted;
    MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
    return res.json({ success: true, message: `Mock status updated for ${rollNumber}`, isBlacklisted });
  }

  return res.status(404).json({ error: 'Student not found in mock database' });
}

// Emulate triggering an outbound webhook exit-notification when a student checks out
export async function sendExitNotification(passId: string, studentDetails: any) {
  const logDetails = {
    endpoint: `https://swd.campus.edu/api/v1/webhooks/gate-exit`,
    direction: LogDirection.outbound,
    payload: { passId, studentDetails, timestamp: new Date() },
    statusCode: 200,
    timestamp: new Date()
  };

  try {
    await prisma.swdIntegrationLog.create({ data: logDetails });
    console.log(`[SWD Outbound Event] Notification sent to SWD for ${studentDetails.name} exiting.`);
  } catch {
    MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
    console.log(`[SWD Outbound Event (Mock)] Mock notification recorded for student ${studentDetails.name}`);
  }
}
