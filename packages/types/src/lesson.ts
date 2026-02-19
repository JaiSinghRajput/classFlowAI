export interface Lesson {
  id: string;
  question: string;
  explanation: ExplanationBlock[];
  timeline: TimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
  status: LessonStatus;
  metadata: LessonMetadata;
}

export interface ExplanationBlock {
  id: string;
  type: 'text' | 'code' | 'diagram' | 'equation';
  content: string;
  order: number;
  duration: number;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  startTime: number;
  endTime: number;
  payload: TimelineEventPayload;
}

export type TimelineEventType =
  | 'cursor_move'
  | 'draw_stroke'
  | 'text_highlight'
  | 'narration_segment'
  | 'pause';

export interface TimelineEventPayload {
  position?: { x: number; y: number };
  path?: { x: number; y: number }[];
  text?: string;
  audioUrl?: string;
  color?: string;
  strokeWidth?: number;
}

export type LessonStatus = 'pending' | 'generating' | 'ready' | 'error';

export interface LessonMetadata {
  subject?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  generationTime: number;
}
