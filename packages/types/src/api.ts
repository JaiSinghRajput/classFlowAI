export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
  timestamp: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface CreateLessonRequest {
  question: string;
  options?: LessonGenerationOptions;
}

export interface LessonGenerationOptions {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  maxDuration?: number;
  includeNarration?: boolean;
  language?: string;
}

export interface CreateLessonResponse {
  lessonId: string;
  status: 'pending' | 'generating';
  estimatedTime: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
