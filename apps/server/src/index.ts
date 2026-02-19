import { logger } from '@classflowai/utils';
import { getConfig } from './config';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const app = await createApp();

  const server = app.listen(config.PORT, () => {
    logger.info('ClassFlowAI server started', {
      port: config.PORT,
      environment: config.NODE_ENV,
      cors: config.CORS_ORIGIN,
    });
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown — timeout exceeded');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}

bootstrap();
