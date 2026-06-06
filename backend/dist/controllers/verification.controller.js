"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_GATE_LOGS = void 0;
exports.generateQRPayload = generateQRPayload;
exports.verifyQRPayload = verifyQRPayload;
exports.simulateRFID = simulateRFID;
const db_1 = __importDefault(require("../config/db"));
const pass_controller_1 = require("./pass.controller");
const auth_controller_1 = require("./auth.controller");
const crypto_1 = require("../utils/crypto");
const socket_1 = require("../socket");
const client_1 = require("@prisma/client");
// Keep a local in-memory log database for fallback
exports.MOCK_GATE_LOGS = [];
// Helper to get a deterministic secret for a pass if DB is down
function getMockSecretForPass(passId) {
    // Just a simple deterministic key derived from passId
    return `mocksec-${passId.substring(0, 10)}`;
}
async function generateQRPayload(req, res) {
    const passId = req.params.passId;
    try {
        // 1. Fetch pass
        const pass = await db_1.default.pass.findUnique({
            where: { id: passId },
            include: { rotatingQrSecret: true, user: true }
        });
        if (pass) {
            if (pass.status !== client_1.PassStatus.approved) {
                return res.status(400).json({ error: 'Pass is not approved' });
            }
            // Check access: only the owner can get the QR generator payload
            if (req.user.role !== client_1.Role.admin && pass.userId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            let secretKey = pass.rotatingQrSecret?.secretKey;
            if (!secretKey) {
                secretKey = 'defaultsecretkey12345';
            }
            const totpToken = (0, crypto_1.getTOTP)(secretKey);
            const data = {
                passId: pass.id,
                totp: totpToken,
                createdAt: Date.now()
            };
            const encryptedPayload = (0, crypto_1.encrypt)(JSON.stringify(data));
            return res.json({ payload: encryptedPayload, refreshInterval: 15 });
        }
    }
    catch (error) {
        console.warn('DB generate QR failed, trying mock fallback.');
    }
    // Fallback Mock Logic
    const mockPass = pass_controller_1.MOCK_PASSES.find(p => p.id === passId);
    if (mockPass) {
        if (mockPass.status !== client_1.PassStatus.approved) {
            return res.status(400).json({ error: 'Pass is not approved' });
        }
        if (req.user.role !== client_1.Role.admin && mockPass.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const secretKey = getMockSecretForPass(passId);
        const totpToken = (0, crypto_1.getTOTP)(secretKey);
        const data = {
            passId: mockPass.id,
            totp: totpToken,
            createdAt: Date.now()
        };
        const encryptedPayload = (0, crypto_1.encrypt)(JSON.stringify(data));
        return res.json({ payload: encryptedPayload, refreshInterval: 15 });
    }
    return res.status(404).json({ error: 'Pass not found' });
}
async function verifyQRPayload(req, res) {
    const { payload } = req.body;
    if (!payload) {
        return res.status(400).json({ error: 'Payload is required' });
    }
    try {
        // 1. Decrypt payload
        const decryptedData = JSON.parse((0, crypto_1.decrypt)(payload));
        const { passId, totp, createdAt } = decryptedData;
        // Check drift - QR expires in 30 seconds to account for slight clock drifts
        if (Date.now() - createdAt > 30000) {
            return res.status(400).json({ error: 'QR Code has expired. Please refresh.' });
        }
        // 2. Fetch pass and secret key
        let pass = await db_1.default.pass.findUnique({
            where: { id: passId },
            include: { rotatingQrSecret: true, user: { include: { studentProfile: true } } }
        });
        let secretKey = '';
        let userDetails = null;
        if (pass) {
            secretKey = pass.rotatingQrSecret?.secretKey || 'defaultsecretkey12345';
            userDetails = pass.user;
        }
        else {
            // Look in Mock data
            const mockPass = pass_controller_1.MOCK_PASSES.find(p => p.id === passId);
            if (mockPass) {
                pass = mockPass;
                secretKey = getMockSecretForPass(passId);
                userDetails = mockPass.user;
            }
        }
        if (!pass) {
            return res.status(404).json({ error: 'Pass not found' });
        }
        if (pass.status !== client_1.PassStatus.approved) {
            return res.status(400).json({ error: 'Pass is no longer approved' });
        }
        // 3. Verify TOTP
        const isValid = (0, crypto_1.checkTOTP)(totp, secretKey);
        if (!isValid) {
            // Register warning log
            const alertLog = {
                id: `log-alert-${Date.now()}`,
                passId: pass.id,
                scannerId: req.user.id,
                scanType: client_1.ScanType.qr,
                actionType: client_1.ActionType.denied,
                timestamp: new Date(),
                notes: 'Invalid/Replayed TOTP signature.',
                pass: { passType: pass.passType },
                user: { name: userDetails?.name, studentProfile: userDetails?.studentProfile }
            };
            (0, socket_1.broadcastGateLog)(alertLog);
            return res.status(400).json({ error: 'Verification failed: invalid code signature' });
        }
        // Determine entry or exit log direction based on previous logs
        let actionType = client_1.ActionType.entry;
        try {
            const lastLog = await db_1.default.gateLog.findFirst({
                where: { passId: pass.id },
                orderBy: { timestamp: 'desc' }
            });
            if (lastLog && lastLog.actionType === client_1.ActionType.entry) {
                actionType = client_1.ActionType.exit;
            }
        }
        catch {
            // Fallback check in mock logs
            const mockLogs = exports.MOCK_GATE_LOGS.filter(l => l.passId === pass.id);
            if (mockLogs.length > 0) {
                const lastMockLog = mockLogs[mockLogs.length - 1];
                if (lastMockLog.actionType === client_1.ActionType.entry) {
                    actionType = client_1.ActionType.exit;
                }
            }
        }
        // 4. Create Entry/Exit log
        const logDetails = {
            passId: pass.id,
            scannerId: req.user.id,
            scanType: client_1.ScanType.qr,
            actionType,
            timestamp: new Date(),
            notes: `QR scan verified successfully. Direction: ${actionType.toUpperCase()}`
        };
        let savedLog = null;
        try {
            savedLog = await db_1.default.gateLog.create({
                data: logDetails,
                include: { pass: true, scanner: true }
            });
            // Append user info for WebSocket client
            savedLog.user = userDetails;
        }
        catch {
            savedLog = {
                id: `log-mock-${Date.now()}`,
                ...logDetails,
                pass: { passType: pass.passType },
                user: { name: userDetails?.name, studentProfile: userDetails?.studentProfile }
            };
            exports.MOCK_GATE_LOGS.push(savedLog);
        }
        // Broadcast live event logs
        (0, socket_1.broadcastGateLog)(savedLog);
        return res.json({ success: true, actionType, log: savedLog });
    }
    catch (err) {
        return res.status(400).json({ error: 'Verification failed: decryption error', details: err.message });
    }
}
async function simulateRFID(req, res) {
    const { rfidTag } = req.body;
    if (!rfidTag) {
        return res.status(400).json({ error: 'rfidTag is required' });
    }
    try {
        // 1. Find user by RFID
        let user = await db_1.default.user.findUnique({
            where: { rfidTag },
            include: { studentProfile: true, facultyProfile: true }
        });
        let mockMode = false;
        if (!user) {
            // Search in mock users
            const mockUser = auth_controller_1.MOCK_USERS.find(u => u.id === rfidTag || u.name.toLowerCase().includes(rfidTag.toLowerCase()));
            if (mockUser) {
                user = mockUser;
                mockMode = true;
            }
        }
        if (!user) {
            // Register invalid tag scan warning
            const errorLog = {
                id: `log-alert-${Date.now()}`,
                passId: null,
                scannerId: req.user.id,
                scanType: client_1.ScanType.rfid,
                actionType: client_1.ActionType.denied,
                timestamp: new Date(),
                notes: `Unregistered RFID tag swiped: "${rfidTag}"`
            };
            (0, socket_1.broadcastGateLog)(errorLog);
            return res.status(404).json({ error: 'RFID card is not registered' });
        }
        // 2. Fetch approved pass for this user
        let activePass = null;
        if (!mockMode) {
            activePass = await db_1.default.pass.findFirst({
                where: {
                    userId: user.id,
                    status: client_1.PassStatus.approved,
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() }
                }
            });
        }
        else {
            // Find in mock passes
            activePass = pass_controller_1.MOCK_PASSES.find(p => p.userId === user?.id &&
                p.status === client_1.PassStatus.approved);
        }
        if (!activePass) {
            // Register scan denied (no active pass)
            const deniedLog = {
                id: `log-mock-${Date.now()}`,
                passId: null,
                scannerId: req.user.id,
                scanType: client_1.ScanType.rfid,
                actionType: client_1.ActionType.denied,
                timestamp: new Date(),
                notes: `RFID swipe denied: No active approved pass found for ${user.name}`,
                user: { name: user.name, studentProfile: user.studentProfile }
            };
            (0, socket_1.broadcastGateLog)(deniedLog);
            return res.status(403).json({ error: `Access denied: No active pass for ${user.name}` });
        }
        // Check entry/exit toggle
        let actionType = client_1.ActionType.entry;
        try {
            const lastLog = await db_1.default.gateLog.findFirst({
                where: { passId: activePass.id },
                orderBy: { timestamp: 'desc' }
            });
            if (lastLog && lastLog.actionType === client_1.ActionType.entry) {
                actionType = client_1.ActionType.exit;
            }
        }
        catch {
            const mockLogs = exports.MOCK_GATE_LOGS.filter(l => l.passId === activePass.id);
            if (mockLogs.length > 0) {
                const lastMockLog = mockLogs[mockLogs.length - 1];
                if (lastMockLog.actionType === client_1.ActionType.entry) {
                    actionType = client_1.ActionType.exit;
                }
            }
        }
        // Log the event
        const logDetails = {
            passId: activePass.id,
            scannerId: req.user.id,
            scanType: client_1.ScanType.rfid,
            actionType,
            timestamp: new Date(),
            notes: `RFID card tapped successfully. Tag UID: ${rfidTag}`
        };
        let savedLog = null;
        try {
            savedLog = await db_1.default.gateLog.create({
                data: logDetails,
                include: { pass: true, scanner: true }
            });
            savedLog.user = user;
        }
        catch {
            savedLog = {
                id: `log-mock-${Date.now()}`,
                ...logDetails,
                pass: { passType: activePass.passType },
                user: { name: user.name, studentProfile: user.studentProfile }
            };
            exports.MOCK_GATE_LOGS.push(savedLog);
        }
        (0, socket_1.broadcastGateLog)(savedLog);
        return res.json({ success: true, actionType, log: savedLog });
    }
    catch (error) {
        return res.status(500).json({ error: 'RFID verification failed', details: error.message });
    }
}
