import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { apiLimiter } from './middlewares/rateLimiter';
import { logger } from './utils/logger';
import { database } from './database/prisma';

export class App {
  public app: Application;
  public server: ReturnType<typeof createServer>;
  public io: Server;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.corsOrigin,
        credentials: true,
      },
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSocketIO();
  }

  private initializeMiddlewares(): void {
    // Trust proxy setting based on environment
    if (config.env === 'development') {
      // In development, trust localhost and loopback
      this.app.set('trust proxy', 'loopback');
    } else {
      // In production, configure specific proxy IPs
      this.app.set('trust proxy', 1);
    }
    
    // Security middleware
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: config.corsOrigin,
        credentials: true,
      }),
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(compression());

    // Logging middleware
    this.app.use(requestLogger);

    // Rate limiting - REMOVED for internal monitoring tool
    // this.app.use('/api/', apiLimiter);

    // Health check endpoint (no auth required)
    this.app.get('/health', async (req, res) => {
      try {
        const { clickHouseService } = require('./services/clickhouseService');
        
        // Check ClickHouse connectivity
        const clickHouseHealthy = await clickHouseService.ping();
        
        // Determine overall health status
        const isHealthy = clickHouseHealthy;
        const status = isHealthy ? 'healthy' : 'degraded';
        
        res.status(isHealthy ? 200 : 503).json({
          status,
          timestamp: new Date().toISOString(),
          service: 'appsentry-backend',
          version: '1.0.0',
          uptime: process.uptime(),
          environment: config.env,
          checks: {
            clickhouse: clickHouseHealthy ? 'healthy' : 'unhealthy',
            api: 'healthy'
          }
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'appsentry-backend',
          version: '1.0.0',
          uptime: process.uptime(),
          environment: config.env,
          error: 'Health check failed'
        });
      }
    });
  }

  private initializeRoutes(): void {
    // Import routes
    const authRoutes = require('./routes/auth.routes').default;
    const applicationRoutes = require('./routes/applications.routes').default;
    const testRoutes = require('./routes/tests.routes').default;
    const otelRoutes = require('./routes/otel.routes').default;
    const telemetryRoutes = require('./routes/telemetry.routes').default;
    const registryRoutes = require('./routes/registry.routes').default;
    const platformMetricsRoutes = require('./routes/platformMetrics.routes').default;

    // OTEL data ingestion routes (no rate limiting)
    this.app.use('/api/otel', otelRoutes);

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/applications', applicationRoutes);
    this.app.use('/api/tests', testRoutes);
    this.app.use('/api/telemetry', telemetryRoutes);
    
    // New application registry and platform routes
    this.app.use('/api/registry/applications', registryRoutes);
    this.app.use('/api/platform', platformMetricsRoutes);
    
    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'AppSentry API',
        version: '1.0.0',
        description: 'Observability & Application Management Platform API',
        endpoints: {
          auth: '/api/auth',
          applications: '/api/applications',
          tests: '/api/tests',
          otel: '/api/otel',
          telemetry: '/api/telemetry',
          registry: '/api/registry/applications',
          platform: '/api/platform',
          health: '/health',
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('subscribe', (data) => {
        if (data.testRunId) {
          socket.join(`test-run-${data.testRunId}`);
          logger.info(`Client ${socket.id} subscribed to test run ${data.testRunId}`);
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  public async initialize(): Promise<void> {
    try {
      // await database.connect(); // TEMPORARILY DISABLED
      logger.info('Database initialization skipped temporarily');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  public listen(): void {
    this.server.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port} in ${config.env} mode`);
    });
  }
}