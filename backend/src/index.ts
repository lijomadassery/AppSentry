import 'reflect-metadata';
import { App } from './app';
import { logger } from './utils/logger';

process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const startServer = async () => {
  try {
    const app = new App();
    await app.initialize();
    app.listen();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();