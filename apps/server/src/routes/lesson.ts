import { Router } from 'express';
import { validate, optionalAuthMiddleware } from '../middleware';
import { rateLimit } from '../middleware/rate-limit';
import { timeoutGuard } from '../middleware/timeout';
import { createLessonBody, generateLessonBody, lessonIdParams } from '../schemas';
import { lessonController } from '../controllers';

const router = Router();

// ---------------------------------------------------------------------------
// POST /lessons — Create a new lesson (protected)
// ---------------------------------------------------------------------------

router.post(
  '/',
  optionalAuthMiddleware,
  rateLimit(),
  validate({ body: createLessonBody }),
  lessonController.createLesson,
);

// ---------------------------------------------------------------------------
// POST /lessons/generate — Trigger lesson generation
// ---------------------------------------------------------------------------

router.post(
  '/generate',
  rateLimit({ max: 20, windowMs: 60_000 }),
  timeoutGuard(60_000),
  validate({ body: generateLessonBody }),
  lessonController.generateLesson,
);

// ---------------------------------------------------------------------------
// GET /lessons/:id — Retrieve a lesson by ID
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  validate({ params: lessonIdParams }),
  lessonController.getLessonById,
);

export default router;
