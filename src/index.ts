import 'reflect-metadata';
import { initializeOTel, shutdownOTel } from './otel';
import { App } from './app';
import { logger } from './utils/logger';
import { config } from './config/env';
import { clickHouseService } from './services/clickhouseService';

// Initialize OpenTelemetry first
const otelSDK = initializeOTel();

process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught Exception:', error);
  await shutdownOTel(otelSDK);
  await clickHouseService.close();
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  await shutdownOTel(otelSDK);
  await clickHouseService.close();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdownOTel(otelSDK);
  await clickHouseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdownOTel(otelSDK);
  await clickHouseService.close();
  process.exit(0);
});

const startServer = async () => {
  try {
    // Check ClickHouse connection
    const isClickHouseHealthy = await clickHouseService.ping();
    if (!isClickHouseHealthy) {
      logger.warn('ClickHouse is not available - telemetry data will not be stored');
    } else {
      logger.info('ClickHouse connection established');
    }

    const app = new App();
    await app.initialize();
    app.listen();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();