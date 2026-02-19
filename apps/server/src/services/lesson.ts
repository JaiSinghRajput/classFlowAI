import mongoose from 'mongoose';
import type { Lesson, LessonStatus, ExplanationBlock, TimelineEvent, LessonMetadata } from '@classflowai/types';
import { LessonModel, ILessonLean } from '../models/LessonModel';

// ---------------------------------------------------------------------------
// Type conversion helpers
// ---------------------------------------------------------------------------

function toLesson(doc: ILessonLean): Lesson {
  return {
    id: doc._id.toHexString(),
    question: doc.question,
    explanation: doc.explanation,
    timeline: doc.timeline,
    status: doc.status,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Create a new lesson in `pending` status.
 */
export async function createLesson(
  question: string,
  userId: string = 'anonymous',
  difficulty?: LessonMetadata['difficulty'],
): Promise<Lesson> {
  const lesson = await LessonModel.create({
    userId,
    question,
    explanation: [],
    timeline: [],
    status: 'pending',
    metadata: {
      subject: undefined,
      difficulty,
      estimatedDuration: 0,
      generationTime: 0,
    },
  });

  return toLesson(lesson);
}

/**
 * Retrieve a lesson by its ID, or `null` if not found.
 */
export async function getLessonById(id: string): Promise<Lesson | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const doc = await LessonModel.findById(id).lean();
  if (!doc) return null;

  return toLesson(doc);
}

/**
 * Update the status of a lesson.
 */
export async function updateLessonStatus(id: string, status: LessonStatus): Promise<Lesson | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const doc = await LessonModel.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true },
  ).lean();

  if (!doc) return null;

  return toLesson(doc);
}

/**
 * Patch a lesson with generated content (explanation blocks, timeline events,
 * metadata).
 */
export async function updateLessonContent(
  id: string,
  explanation: ExplanationBlock[],
  timeline: TimelineEvent[],
  metadata: Partial<LessonMetadata>,
): Promise<Lesson | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const doc = await LessonModel.findByIdAndUpdate(
    id,
    {
      $set: {
        explanation,
        timeline,
        'metadata.estimatedDuration': metadata.estimatedDuration,
        'metadata.generationTime': metadata.generationTime,
        'metadata.subject': metadata.subject,
        'metadata.difficulty': metadata.difficulty,
        updatedAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  if (!doc) return null;

  return toLesson(doc);
}

/**
 * Return a paginated slice of all lessons, newest first.
 */
export async function listLessons(
  page: number,
  pageSize: number,
): Promise<{ items: Lesson[]; total: number }> {
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    LessonModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    LessonModel.estimatedDocumentCount(),
  ]);

  return {
    items: items.map(toLesson),
    total,
  };
}
