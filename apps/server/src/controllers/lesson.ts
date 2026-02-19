import type { Request, Response } from 'express';
import type {
  ApiResponse,
  CreateLessonResponse,
  Lesson,
} from '@classflowai/types';
import { sanitizeInput } from '@classflowai/utils';
import { AppError } from '../middleware/error-handler';
import { lessonService, generationService } from '../services';
import type { CreateLessonBody, GenerateLessonBody, LessonIdParams } from '../schemas';

// ---------------------------------------------------------------------------
// POST /lessons — Create a new lesson
// ---------------------------------------------------------------------------

export async function createLesson(
  req: Request<Record<string, string>, unknown, CreateLessonBody>,
  res: Response,
): Promise<void> {
  const { question, options } = req.body;
  const sanitizedQuestion = sanitizeInput(question);

  const lesson = await lessonService.createLesson(sanitizedQuestion, 'anonymous', options?.difficulty);

  const response: ApiResponse<CreateLessonResponse> = {
    success: true,
    data: {
      lessonId: lesson.id,
      status: 'pending',
      estimatedTime: 5000,
    },
    timestamp: Date.now(),
  };

  res.status(201).json(response);
}

// ---------------------------------------------------------------------------
// POST /lessons/generate — Generate lesson content
// ---------------------------------------------------------------------------

export async function generateLesson(
  req: Request<Record<string, string>, unknown, GenerateLessonBody>,
  res: Response,
): Promise<void> {
  const { lessonId } = req.body;

  const lesson = await lessonService.getLessonById(lessonId);
  if (!lesson) {
    throw new AppError('Lesson not found', 404, 'LESSON_NOT_FOUND');
  }

  if (lesson.status === 'generating') {
    throw new AppError('Lesson is already being generated', 409, 'GENERATION_IN_PROGRESS');
  }

  if (lesson.status === 'ready') {
    throw new AppError('Lesson has already been generated', 409, 'ALREADY_GENERATED');
  }

  generationService.generateLessonContent(lessonId).catch(() => {
    // Generation runs in the background; errors are logged by the service.
  });

  const response: ApiResponse<CreateLessonResponse> = {
    success: true,
    data: {
      lessonId: lesson.id,
      status: 'generating',
      estimatedTime: 3000,
    },
    timestamp: Date.now(),
  };

  res.status(202).json(response);
}

// ---------------------------------------------------------------------------
// GET /lessons/:id — Get lesson by ID
// ---------------------------------------------------------------------------

export async function getLessonById(
  req: Request<LessonIdParams>,
  res: Response,
): Promise<void> {
  const { id } = req.params;

  const lesson = await lessonService.getLessonById(id);
  if (!lesson) {
    throw new AppError('Lesson not found', 404, 'LESSON_NOT_FOUND');
  }

  const response: ApiResponse<Lesson> = {
    success: true,
    data: lesson,
    timestamp: Date.now(),
  };

  res.json(response);
}
