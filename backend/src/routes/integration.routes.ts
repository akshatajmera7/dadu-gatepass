import { Router } from 'express';
import { getStudentByRollNumber, syncStudentStatus, authenticateSWD } from '../controllers/integration.controller';

const router = Router();

router.use(authenticateSWD);

router.get('/swd/student/:rollNumber', getStudentByRollNumber);
router.post('/swd/sync-status', syncStudentStatus);

export default router;
