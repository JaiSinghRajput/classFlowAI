import { Router } from 'express';
import healthRouter from './health';
import lessonRouter from './lesson';
import authRouter from './auth';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/lessons', lessonRouter);

export default router;
