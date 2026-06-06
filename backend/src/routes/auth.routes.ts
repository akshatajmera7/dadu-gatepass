import { Router } from 'express';
import { login, getProfile, seedUsers } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.post('/login', login);
router.get('/profile', authenticateJWT, getProfile);
router.post('/seed', seedUsers);

export default router;
