import { Router } from 'express';
import type { ApiResponse } from '@classflowai/types';

const router = Router();

interface HealthCheckData {
  status: string;
  uptime: number;
  timestamp: number;
  environment: string;
}

router.get('/', (_req, res) => {
  const response: ApiResponse<HealthCheckData> = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: Date.now(),
      environment: process.env['NODE_ENV'] ?? 'development',
    },
    timestamp: Date.now(),
  };

  res.json(response);
});

export default router;
