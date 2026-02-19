import type { Request, Response, NextFunction } from 'express';
import { logger } from '@classflowai/utils';
import type { ApiResponse } from '@classflowai/types';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError;

  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const details = isAppError ? err.details : undefined;

  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      message: err.message,
      stack: err.stack,
      code,
    });
  } else {
    logger.warn('Client error', {
      message: err.message,
      code,
      statusCode,
    });
  }

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code,
      message: statusCode >= 500 ? 'Internal server error' : err.message,
      details,
    },
    timestamp: Date.now(),
  };

  res.status(statusCode).json(response);
}
