import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /lessons — Create Lesson
// ---------------------------------------------------------------------------

export const createLessonBody = z.object({
  question: z
    .string()
    .min(3, 'Question must be at least 3 characters')
    .max(2000, 'Question must be at most 2000 characters')
    .trim(),
  options: z
    .object({
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      maxDuration: z.number().positive().max(600_000).optional(),
      includeNarration: z.boolean().optional(),
      language: z.string().min(2).max(10).optional(),
    })
    .optional(),
});

export type CreateLessonBody = z.infer<typeof createLessonBody>;

// ---------------------------------------------------------------------------
// POST /lessons/generate — Generate Lesson Content
// ---------------------------------------------------------------------------

export const generateLessonBody = z.object({
  lessonId: z.string().min(1, 'lessonId is required'),
});

export type GenerateLessonBody = z.infer<typeof generateLessonBody>;

// ---------------------------------------------------------------------------
// GET /lessons/:id — Get Lesson by ID
// ---------------------------------------------------------------------------

export const lessonIdParams = z.object({
  id: z.string().min(1, 'Lesson ID is required'),
});

export type LessonIdParams = z.infer<typeof lessonIdParams>;
