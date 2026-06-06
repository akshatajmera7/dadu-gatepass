import { Router } from 'express';
import authRoutes from './auth.routes';
import passRoutes from './pass.routes';
import verificationRoutes from './verification.routes';
import integrationRoutes from './integration.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/passes', passRoutes);
router.use('/verification', verificationRoutes);
router.use('/integration', integrationRoutes);

export default router;
