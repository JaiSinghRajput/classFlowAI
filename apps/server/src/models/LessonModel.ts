import mongoose, { Schema, Document, Model } from 'mongoose';
import type { LessonStatus, ExplanationBlock, TimelineEvent, LessonMetadata } from '@classflowai/types';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface ILesson extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  question: string;
  explanation: ExplanationBlock[];
  timeline: TimelineEvent[];
  status: LessonStatus;
  metadata: LessonMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILessonLean {
  _id: mongoose.Types.ObjectId;
  userId: string;
  question: string;
  explanation: ExplanationBlock[];
  timeline: TimelineEvent[];
  status: LessonStatus;
  metadata: LessonMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Subdocument Schemas
// ---------------------------------------------------------------------------

const ExplanationBlockSchema = new Schema<ExplanationBlock>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['text', 'code', 'diagram', 'equation'], required: true },
    content: { type: String, required: true },
    order: { type: Number, required: true },
    duration: { type: Number, required: true },
  },
  { _id: false },
);

const TimelineEventSchema = new Schema<TimelineEvent>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['cursor_move', 'draw_stroke', 'text_highlight', 'narration_segment', 'pause'],
      required: true,
    },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const LessonMetadataSchema = new Schema<LessonMetadata>(
  {
    subject: { type: String },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    estimatedDuration: { type: Number, required: true },
    generationTime: { type: Number, required: true },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Main Schema
// ---------------------------------------------------------------------------

const LessonSchema = new Schema<ILesson>(
  {
    userId: { type: String, required: true, index: true },
    question: { type: String, required: true, trim: true },
    explanation: { type: [ExplanationBlockSchema], default: [] },
    timeline: { type: [TimelineEventSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'generating', 'ready', 'error'],
      default: 'pending',
    },
    metadata: { type: LessonMetadataSchema, required: true },
  },
  {
    timestamps: true,
  },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

LessonSchema.index({ userId: 1, status: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const LessonModel: Model<ILesson> = mongoose.models.Lesson || mongoose.model<ILesson>('Lesson', LessonSchema);
