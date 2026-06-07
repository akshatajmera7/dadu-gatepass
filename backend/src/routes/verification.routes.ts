import { Router } from 'express';
import { generateQRPayload, verifyQRPayload, simulateRFID, publicVerifyQR } from '../controllers/verification.controller';
import { authenticateJWT, requireRoles } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Public route — no auth needed (for phone camera QR scanning)
router.post('/qr/public-verify', publicVerifyQR);

// All routes below require authentication
router.use(authenticateJWT);

router.get('/qr/generate/:passId', generateQRPayload);
router.post('/qr/verify', requireRoles(Role.gate_security, Role.admin), verifyQRPayload);
router.post('/rfid/simulate', requireRoles(Role.gate_security, Role.admin), simulateRFID);

export default router;
