import { Router } from 'express';
import { createPass, getPasses, getPassById, updatePassStatus } from '../controllers/pass.controller';
import { authenticateJWT, requireRoles } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateJWT);

router.post('/', requireRoles(Role.student, Role.faculty, Role.conference_supervisor, Role.admin), createPass);
router.get('/', getPasses);
router.get('/:id', getPassById);
router.patch('/:id/status', requireRoles(Role.hostel_superintendent, Role.conference_supervisor, Role.faculty, Role.admin), updatePassStatus);

export default router;
