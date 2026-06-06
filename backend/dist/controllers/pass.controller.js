"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_PASSES = void 0;
exports.createPass = createPass;
exports.getPasses = getPasses;
exports.getPassById = getPassById;
exports.updatePassStatus = updatePassStatus;
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const crypto_1 = require("../utils/crypto");
// In-Memory Pass Database for fallback
exports.MOCK_PASSES = [
    {
        id: 'pass-student-001',
        passType: client_1.PassType.student_permanent,
        userId: 'd3b07384-d113-4ec5-a587-3932e65c0001',
        status: client_1.PassStatus.approved,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        passDetails: {
            hostelName: 'Krishna Bhawan',
            roomNumber: 'A-212',
            reason: 'Academic Year Outpass',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
            name: 'Akshat Sharma',
            role: client_1.Role.student,
            studentProfile: { rollNumber: '2026A7PS0101P' }
        },
        approvalWorkflows: [
            {
                id: 'wf-001',
                stepOrder: 1,
                status: client_1.WorkflowStatus.approved,
                comments: 'Approved for the academic term',
                processedAt: new Date(),
            }
        ]
    },
    {
        id: 'pass-visitor-002',
        passType: client_1.PassType.single_day_visitor,
        userId: 'd3b07384-d113-4ec5-a587-3932e65c0001',
        status: client_1.PassStatus.pending_approval,
        startDate: new Date(),
        endDate: new Date(),
        passDetails: {
            visitorName: 'John Doe',
            visitorPhone: '9998887776',
            reason: 'Project Collaboration',
            hostName: 'Akshat Sharma',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
            name: 'Akshat Sharma',
            role: client_1.Role.student
        },
        approvalWorkflows: [
            {
                id: 'wf-002',
                stepOrder: 1,
                status: client_1.WorkflowStatus.pending,
                comments: null,
            }
        ]
    }
];
async function createPass(req, res) {
    const { passType, startDate, endDate, passDetails } = req.body;
    if (!passType || !startDate || !endDate) {
        return res.status(400).json({ error: 'passType, startDate, and endDate are required' });
    }
    const userId = req.user.id;
    const initialStatus = (passType === client_1.PassType.faculty_permanent)
        ? client_1.PassStatus.approved
        : client_1.PassStatus.pending_approval;
    try {
        const pass = await db_1.default.pass.create({
            data: {
                passType,
                userId,
                status: initialStatus,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                passDetails: passDetails || {},
                rotatingQrSecret: {
                    create: {
                        secretKey: (0, crypto_1.generateSecret)(),
                        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
                    }
                }
            },
            include: { user: true }
        });
        if (passType === client_1.PassType.student_permanent || passType === client_1.PassType.single_day_visitor) {
            await db_1.default.approvalWorkflow.create({
                data: {
                    passId: pass.id,
                    stepOrder: 1,
                    status: client_1.WorkflowStatus.pending,
                }
            });
        }
        return res.status(201).json({ pass, isMock: false });
    }
    catch (error) {
        console.warn('DB create pass failed, falling back to mock database storage.');
    }
    // Fallback Mock Logic
    const newPass = {
        id: `pass-mock-${Date.now()}`,
        passType,
        userId,
        status: initialStatus,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        passDetails: passDetails || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
            name: req.user.name,
            role: req.user.role
        },
        approvalWorkflows: [
            {
                id: `wf-mock-${Date.now()}`,
                stepOrder: 1,
                status: initialStatus === client_1.PassStatus.approved ? client_1.WorkflowStatus.approved : client_1.WorkflowStatus.pending,
                comments: null,
            }
        ]
    };
    exports.MOCK_PASSES.push(newPass);
    return res.status(201).json({ pass: newPass, isMock: true });
}
async function getPasses(req, res) {
    const { role, id } = req.user;
    const status = req.query.status;
    const type = req.query.type;
    try {
        const whereClause = {};
        if (role === client_1.Role.student || role === client_1.Role.faculty) {
            whereClause.userId = id;
        }
        if (status)
            whereClause.status = status;
        if (type)
            whereClause.passType = type;
        const passes = await db_1.default.pass.findMany({
            where: whereClause,
            include: {
                user: {
                    include: { studentProfile: true, facultyProfile: true }
                },
                approvalWorkflows: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json({ passes, isMock: false });
    }
    catch (error) {
        console.warn('DB get passes failed, using mock database.');
    }
    // Fallback Mock Filtering
    let filtered = [...exports.MOCK_PASSES];
    if (role === client_1.Role.student || role === client_1.Role.faculty) {
        filtered = filtered.filter(p => p.userId === id);
    }
    if (status) {
        filtered = filtered.filter(p => p.status === status);
    }
    if (type) {
        filtered = filtered.filter(p => p.passType === type);
    }
    return res.json({ passes: filtered, isMock: true });
}
async function getPassById(req, res) {
    const id = req.params.id;
    try {
        const pass = await db_1.default.pass.findUnique({
            where: { id },
            include: { user: true, approvalWorkflows: true }
        });
        if (pass) {
            if (req.user.role !== client_1.Role.admin && req.user.role !== client_1.Role.gate_security && req.user.role !== client_1.Role.hostel_superintendent) {
                if (pass.userId !== req.user.id) {
                    return res.status(403).json({ error: 'Access denied to this pass' });
                }
            }
            return res.json({ pass, isMock: false });
        }
    }
    catch {
        // Fail to mock
    }
    const mockPass = exports.MOCK_PASSES.find(p => p.id === id);
    if (mockPass) {
        if (req.user.role !== client_1.Role.admin && req.user.role !== client_1.Role.gate_security && req.user.role !== client_1.Role.hostel_superintendent) {
            if (mockPass.userId !== req.user.id) {
                return res.status(403).json({ error: 'Access denied to this pass' });
            }
        }
        return res.json({ pass: mockPass, isMock: true });
    }
    return res.status(404).json({ error: 'Pass not found' });
}
async function updatePassStatus(req, res) {
    const id = req.params.id;
    const { status, comments } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be approved or rejected' });
    }
    const newPassStatus = status === 'approved' ? client_1.PassStatus.approved : client_1.PassStatus.rejected;
    const workflowStatus = status === 'approved' ? client_1.WorkflowStatus.approved : client_1.WorkflowStatus.rejected;
    try {
        const updatedPass = await db_1.default.pass.update({
            where: { id },
            data: {
                status: newPassStatus,
                approvalWorkflows: {
                    updateMany: {
                        where: { status: client_1.WorkflowStatus.pending },
                        data: {
                            status: workflowStatus,
                            comments,
                            processedAt: new Date()
                        }
                    }
                }
            },
            include: { user: true, approvalWorkflows: true }
        });
        return res.json({ pass: updatedPass, isMock: false });
    }
    catch (error) {
        console.warn('DB update pass failed, updating mock database.');
    }
    // Fallback Mock Update
    const mockPassIndex = exports.MOCK_PASSES.findIndex(p => p.id === id);
    if (mockPassIndex !== -1) {
        const updatedMockPass = {
            ...exports.MOCK_PASSES[mockPassIndex],
            status: newPassStatus,
            updatedAt: new Date(),
            approvalWorkflows: exports.MOCK_PASSES[mockPassIndex].approvalWorkflows.map((wf) => ({
                ...wf,
                status: workflowStatus,
                comments,
                processedAt: new Date()
            }))
        };
        exports.MOCK_PASSES[mockPassIndex] = updatedMockPass;
        return res.json({ pass: updatedMockPass, isMock: true });
    }
    return res.status(404).json({ error: 'Pass not found' });
}
