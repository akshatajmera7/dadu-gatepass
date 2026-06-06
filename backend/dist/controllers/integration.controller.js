"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_SWD_LOGS = void 0;
exports.authenticateSWD = authenticateSWD;
exports.getStudentByRollNumber = getStudentByRollNumber;
exports.syncStudentStatus = syncStudentStatus;
exports.sendExitNotification = sendExitNotification;
const db_1 = __importDefault(require("../config/db"));
const auth_controller_1 = require("./auth.controller");
const client_1 = require("@prisma/client");
exports.MOCK_SWD_LOGS = [];
// Middleware to authenticate SWD requests
function authenticateSWD(req, res, next) {
    const apiKey = Array.isArray(req.headers['x-api-key']) ? req.headers['x-api-key'][0] : req.headers['x-api-key'];
    const configuredKey = process.env.SWD_API_KEY || 'swd-secret-api-key-abcde';
    if (!apiKey || apiKey !== configuredKey) {
        return res.status(401).json({ error: 'Unauthorized SWD Integration Access: invalid API key' });
    }
    next();
}
async function getStudentByRollNumber(req, res) {
    const rollNumber = req.params.rollNumber;
    // Log incoming SWD requests
    const logDetails = {
        endpoint: `/api/v1/integration/swd/student/${rollNumber}`,
        direction: client_1.LogDirection.inbound,
        payload: { rollNumber },
        statusCode: 200,
        timestamp: new Date()
    };
    try {
        const student = await db_1.default.studentProfile.findUnique({
            where: { rollNumber },
            include: { user: true }
        });
        if (student) {
            await db_1.default.swdIntegrationLog.create({ data: logDetails });
            return res.json({ student });
        }
    }
    catch {
        // Fail to mock
    }
    // Mock Lookup Fallback
    const mockUser = auth_controller_1.MOCK_USERS.find(u => u.studentProfile?.rollNumber === rollNumber);
    if (mockUser) {
        exports.MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
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
    exports.MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
    return res.status(404).json({ error: 'Student roll number not found' });
}
async function syncStudentStatus(req, res) {
    const rollNumber = req.body.rollNumber;
    const isBlacklisted = req.body.isBlacklisted;
    if (!rollNumber || isBlacklisted === undefined) {
        return res.status(400).json({ error: 'rollNumber and isBlacklisted (boolean) are required' });
    }
    const logDetails = {
        endpoint: `/api/v1/integration/swd/sync-status`,
        direction: client_1.LogDirection.inbound,
        payload: req.body,
        statusCode: 200,
        timestamp: new Date()
    };
    try {
        const student = await db_1.default.studentProfile.update({
            where: { rollNumber },
            data: { isBlacklisted },
            include: { user: true }
        });
        await db_1.default.swdIntegrationLog.create({ data: logDetails });
        return res.json({ success: true, message: `Status synchronized for ${rollNumber}`, student });
    }
    catch {
        // Fail to mock
    }
    // Mock sync status
    const mockUser = auth_controller_1.MOCK_USERS.find(u => u.studentProfile?.rollNumber === rollNumber);
    if (mockUser) {
        mockUser.studentProfile.isBlacklisted = isBlacklisted;
        exports.MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
        return res.json({ success: true, message: `Mock status updated for ${rollNumber}`, isBlacklisted });
    }
    return res.status(404).json({ error: 'Student not found in mock database' });
}
// Emulate triggering an outbound webhook exit-notification when a student checks out
async function sendExitNotification(passId, studentDetails) {
    const logDetails = {
        endpoint: `https://swd.campus.edu/api/v1/webhooks/gate-exit`,
        direction: client_1.LogDirection.outbound,
        payload: { passId, studentDetails, timestamp: new Date() },
        statusCode: 200,
        timestamp: new Date()
    };
    try {
        await db_1.default.swdIntegrationLog.create({ data: logDetails });
        console.log(`[SWD Outbound Event] Notification sent to SWD for ${studentDetails.name} exiting.`);
    }
    catch {
        exports.MOCK_SWD_LOGS.push({ id: `swd-log-${Date.now()}`, ...logDetails });
        console.log(`[SWD Outbound Event (Mock)] Mock notification recorded for student ${studentDetails.name}`);
    }
}
