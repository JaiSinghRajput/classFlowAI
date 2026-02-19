import type { Request, Response } from 'express';
import type { ApiResponse } from '@classflowai/types';

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: Date.now(),
  };

  res.status(404).json(response);
}
