import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { Role } from '@prisma/client';

// Hardcoded in-memory users for Demo/Fallback mode if DB is disconnected
export const MOCK_USERS = [
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0001',
    email: 'student@campus.edu',
    passwordHash: bcrypt.hashSync('student123', 10),
    name: 'Akshat Sharma',
    phone: '9876543210',
    role: Role.student,
    studentProfile: {
      rollNumber: '2026A7PS0101P',
      hostelName: 'Krishna Bhawan',
      roomNumber: 'A-212',
      parentPhone: '9876543211',
      isBlacklisted: false,
    }
  },
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0002',
    email: 'faculty@campus.edu',
    passwordHash: bcrypt.hashSync('faculty123', 10),
    name: 'Dr. Ramesh Kumar',
    phone: '9876543220',
    role: Role.faculty,
    facultyProfile: {
      employeeId: 'EMP_FAC_5001',
      department: 'Computer Science',
      designation: 'Professor',
    }
  },
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0003',
    email: 'superintendent@campus.edu',
    passwordHash: bcrypt.hashSync('super123', 10),
    name: 'Sh. Vinod Prasad',
    phone: '9876543230',
    role: Role.hostel_superintendent,
  },
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0004',
    email: 'supervisor@campus.edu',
    passwordHash: bcrypt.hashSync('superv123', 10),
    name: 'Prof. Sunita Sen',
    phone: '9876543240',
    role: Role.conference_supervisor,
  },
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0005',
    email: 'security@campus.edu',
    passwordHash: bcrypt.hashSync('security123', 10),
    name: 'Officer Rajesh Singh',
    phone: '9876543250',
    role: Role.gate_security,
  },
  {
    id: 'd3b07384-d113-4ec5-a587-3932e65c0006',
    email: 'admin@campus.edu',
    passwordHash: bcrypt.hashSync('admin123', 10),
    name: 'System Admin',
    phone: '9876543260',
    role: Role.admin,
  }
];

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-12345!';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-12345!';

  const generateTokens = (user: any) => {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret,
      { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
  };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true, facultyProfile: true }
    });

    if (user && bcrypt.compareSync(password, user.passwordHash)) {
      const { accessToken, refreshToken } = generateTokens(user);
      return res.json({
        user: { id: user.id, email: user.email, role: user.role, name: user.name },
        accessToken,
        refreshToken,
        isMock: false
      });
    }
  } catch (error) {
    console.warn('Database lookup failed. Trying Mock login fallback.');
  }

  // Fallback to Mock login
  const mockUser = MOCK_USERS.find(u => u.email === email);
  if (mockUser && bcrypt.compareSync(password, mockUser.passwordHash)) {
    const { accessToken, refreshToken } = generateTokens(mockUser);
    return res.json({
      user: { id: mockUser.id, email: mockUser.email, role: mockUser.role, name: mockUser.name },
      accessToken,
      refreshToken,
      isMock: true
    });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}

export async function getProfile(req: Request, res: Response) {
  const authReq = req as any;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = authReq.user;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, facultyProfile: true }
    });

    if (user) {
      return res.json({ user });
    }
  } catch {
    // Silent fail to fallback
  }

  const mockUser = MOCK_USERS.find(u => u.id === id);
  if (mockUser) {
    return res.json({ user: mockUser });
  }

  return res.status(404).json({ error: 'User profile not found' });
}

export async function seedUsers(req: Request, res: Response) {
  try {
    for (const u of MOCK_USERS) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone,
            role: u.role,
            studentProfile: u.studentProfile ? { create: u.studentProfile } : undefined,
            facultyProfile: u.facultyProfile ? { create: u.facultyProfile } : undefined,
          }
        });
        console.log(`Seeded user: ${u.email}`);
      }
    }
    return res.json({ message: 'Users seeded successfully or already exist' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Seeding failed', details: error.message });
  }
}
