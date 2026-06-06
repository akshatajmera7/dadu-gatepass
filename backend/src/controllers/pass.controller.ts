import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import { PassStatus, PassType, Role, WorkflowStatus } from '@prisma/client';
import { generateSecret } from '../utils/crypto';

// In-Memory Pass Database for fallback
export let MOCK_PASSES: any[] = [
  {
    id: 'pass-student-001',
    passType: PassType.student_permanent,
    userId: 'd3b07384-d113-4ec5-a587-3932e65c0001',
    status: PassStatus.approved,
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
      role: Role.student,
      studentProfile: { rollNumber: '2026A7PS0101P' }
    },
    approvalWorkflows: [
      {
        id: 'wf-001',
        stepOrder: 1,
        status: WorkflowStatus.approved,
        comments: 'Approved for the academic term',
        processedAt: new Date(),
      }
    ]
  },
  {
    id: 'pass-visitor-002',
    passType: PassType.single_day_visitor,
    userId: 'd3b07384-d113-4ec5-a587-3932e65c0001',
    status: PassStatus.pending_approval,
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
      role: Role.student
    },
    approvalWorkflows: [
      {
        id: 'wf-002',
        stepOrder: 1,
        status: WorkflowStatus.pending,
        comments: null,
      }
    ]
  }
];

export async function createPass(req: AuthenticatedRequest, res: Response) {
  const { passType, startDate, endDate, passDetails } = req.body;
  if (!passType || !startDate || !endDate) {
    return res.status(400).json({ error: 'passType, startDate, and endDate are required' });
  }

  const userId = req.user!.id;
  const initialStatus = (passType === PassType.faculty_permanent)
    ? PassStatus.approved
    : PassStatus.pending_approval;

  try {
    const pass = await prisma.pass.create({
      data: {
        passType,
        userId,
        status: initialStatus,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        passDetails: passDetails || {},
        rotatingQrSecret: {
          create: {
            secretKey: generateSecret(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year
          }
        }
      },
      include: { user: true }
    });

    if (passType === PassType.student_permanent || passType === PassType.single_day_visitor) {
      await prisma.approvalWorkflow.create({
        data: {
          passId: pass.id,
          stepOrder: 1,
          status: WorkflowStatus.pending,
        }
      });
    }

    return res.status(201).json({ pass, isMock: false });
  } catch (error: any) {
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
      name: req.user!.name,
      role: req.user!.role
    },
    approvalWorkflows: [
      {
        id: `wf-mock-${Date.now()}`,
        stepOrder: 1,
        status: initialStatus === PassStatus.approved ? WorkflowStatus.approved : WorkflowStatus.pending,
        comments: null,
      }
    ]
  };

  MOCK_PASSES.push(newPass);
  return res.status(201).json({ pass: newPass, isMock: true });
}

export async function getPasses(req: AuthenticatedRequest, res: Response) {
  const { role, id } = req.user!;
  const status = req.query.status as PassStatus | undefined;
  const type = req.query.type as PassType | undefined;

  try {
    const whereClause: any = {};
    
    if (role === Role.student || role === Role.faculty) {
      whereClause.userId = id;
    }
    
    if (status) whereClause.status = status as PassStatus;
    if (type) whereClause.passType = type as PassType;

    const passes = await prisma.pass.findMany({
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
  } catch (error) {
    console.warn('DB get passes failed, using mock database.');
  }

  // Fallback Mock Filtering
  let filtered = [...MOCK_PASSES];
  
  if (role === Role.student || role === Role.faculty) {
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

export async function getPassById(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string;

  try {
    const pass = await prisma.pass.findUnique({
      where: { id },
      include: { user: true, approvalWorkflows: true }
    });

    if (pass) {
      if (req.user!.role !== Role.admin && req.user!.role !== Role.gate_security && req.user!.role !== Role.hostel_superintendent) {
        if (pass.userId !== req.user!.id) {
          return res.status(403).json({ error: 'Access denied to this pass' });
        }
      }
      return res.json({ pass, isMock: false });
    }
  } catch {
    // Fail to mock
  }

  const mockPass = MOCK_PASSES.find(p => p.id === id);
  if (mockPass) {
    if (req.user!.role !== Role.admin && req.user!.role !== Role.gate_security && req.user!.role !== Role.hostel_superintendent) {
      if (mockPass.userId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied to this pass' });
      }
    }
    return res.json({ pass: mockPass, isMock: true });
  }

  return res.status(404).json({ error: 'Pass not found' });
}

export async function updatePassStatus(req: AuthenticatedRequest, res: Response) {
  const id = req.params.id as string;
  const { status, comments } = req.body;
  
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be approved or rejected' });
  }

  const newPassStatus = status === 'approved' ? PassStatus.approved : PassStatus.rejected;
  const workflowStatus = status === 'approved' ? WorkflowStatus.approved : WorkflowStatus.rejected;

  try {
    const updatedPass = await prisma.pass.update({
      where: { id },
      data: {
        status: newPassStatus,
        approvalWorkflows: {
          updateMany: {
            where: { status: WorkflowStatus.pending },
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
  } catch (error) {
    console.warn('DB update pass failed, updating mock database.');
  }

  // Fallback Mock Update
  const mockPassIndex = MOCK_PASSES.findIndex(p => p.id === id);
  if (mockPassIndex !== -1) {
    const updatedMockPass = {
      ...MOCK_PASSES[mockPassIndex],
      status: newPassStatus,
      updatedAt: new Date(),
      approvalWorkflows: MOCK_PASSES[mockPassIndex].approvalWorkflows.map((wf: any) => ({
        ...wf,
        status: workflowStatus,
        comments,
        processedAt: new Date()
      }))
    };
    MOCK_PASSES[mockPassIndex] = updatedMockPass;
    return res.json({ pass: updatedMockPass, isMock: true });
  }

  return res.status(404).json({ error: 'Pass not found' });
}
