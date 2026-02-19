export interface UserDocument {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  playbackSpeed: number;
  autoPlay: boolean;
}

export interface LessonDocument {
  _id: string;
  userId: string;
  question: string;
  explanation: SerializedExplanationBlock[];
  timeline: SerializedTimelineEvent[];
  status: 'pending' | 'generating' | 'ready' | 'error';
  metadata: SerializedLessonMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedExplanationBlock {
  id: string;
  type: 'text' | 'code' | 'diagram' | 'equation';
  content: string;
  order: number;
  duration: number;
}

export interface SerializedTimelineEvent {
  id: string;
  type: string;
  startTime: number;
  endTime: number;
  payload: Record<string, unknown>;
}

export interface SerializedLessonMetadata {
  subject?: string;
  difficulty?: string;
  estimatedDuration: number;
  generationTime: number;
}

export interface SessionDocument {
  _id: string;
  userId: string;
  lessonId: string;
  progress: number;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ProgressDocument {
  _id: string;
  userId: string;
  lessonId: string;
  watchedDuration: number;
  totalDuration: number;
  completionPercentage: number;
  lastPosition: number;
  updatedAt: Date;
}

export interface CollectionIndexes {
  users: { email: 1 };
  lessons: { userId: 1; status: 1; createdAt: -1 };
  sessions: { userId: 1; lessonId: 1 };
  progress: { userId: 1; lessonId: 1 };
}
