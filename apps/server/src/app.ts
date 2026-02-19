import express from 'express';
import cors from 'cors';
import { getConfig } from './config';
import { connectToDatabase } from './db';
import {
  requestLogger,
  notFoundHandler,
  errorHandler,
  securityHeaders,
  sanitizeInput,
  limitRequestSize,
} from './middleware';
import { slowDownMiddleware } from './utils/security';
import routes from './routes';

export async function createApp(): Promise<express.Express> {
  const config = getConfig();
  const app = express();

  // Connect to MongoDB if URI is provided
  if (config.mongodbUri) {
    try {
      await connectToDatabase();
    } catch (error) {
      console.warn('⚠️  MongoDB connection failed — running with in-memory store');
    }
  } else {
    console.warn('⚠️  MONGODB_URI not set — running with in-memory store');
  }

  // Security middleware
  app.use(securityHeaders);

  app.use(cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Security & performance middleware
  app.use(sanitizeInput);
  app.use(limitRequestSize);
  app.use(slowDownMiddleware);
  app.use(requestLogger);

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
