import { Router, Request, Response } from 'express';
import { authenticateToken, requireEditor, requireViewer } from '../middlewares/auth';
import { validate, validateQuery, validateParams } from '../middlewares/validation';
import { Environment, CreateApplicationInput, UpdateApplicationInput } from '../types';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';
import { metrics } from '@opentelemetry/api';
import Joi from 'joi';

// Create a meter for custom metrics
const meter = metrics.getMeter('appsentry-backend', '1.0.0');

// Create custom metrics
const applicationRequestCounter = meter.createCounter('application_requests_total', {
  description: 'Total number of application API requests',
});

const applicationRequestDuration = meter.createHistogram('application_request_duration_ms', {
  description: 'Duration of application API requests in milliseconds',
});

const applicationCount = meter.createUpDownCounter('applications_total', {
  description: 'Total number of applications in the system',
});

const router = Router();

// Get application statistics (placed first to avoid middleware conflicts)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    logger.info('Stats endpoint called');
    
    // Use mock data for development when DB is not available
    const stats = {
      totalApplications: 2,
      healthyCount: 2,
      warningCount: 0,
      errorCount: 0,
      overallHealth: 100,
      averageResponseTime: 85,
      totalUptime: 99.8,
      slaCompliance: 99.5,
    };

    logger.info('Returning stats', { stats });
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get application statistics', { error });
    res.status(500).json({
      error: {
        message: 'Failed to retrieve statistics',
        code: 'GET_STATS_FAILED',
      },
    });
  }
});

// Validation schemas
const createApplicationSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  displayName: Joi.string().required().min(1).max(255),
  description: Joi.string().optional().max(1000),
  environment: Joi.string().valid(...Object.values(Environment)).required(),
  category: Joi.string().required().min(1).max(50),
  healthUrl: Joi.string().uri().required().max(500),
  loginUrl: Joi.string().uri().optional().max(500),
  config: Joi.object().required(),
  ownerTeam: Joi.string().optional().max(100),
  ownerEmail: Joi.string().email().optional().max(255),
  tags: Joi.array().items(Joi.string()).optional(),
});

const updateApplicationSchema = createApplicationSchema.fork(
  ['name', 'displayName', 'environment', 'category', 'healthUrl', 'config'],
  (schema) => schema.optional(),
);

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  environment: Joi.string().valid(...Object.values(Environment)).optional(),
  category: Joi.string().optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().optional(),
});

const paramSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Get all applications
router.get(
  '/',
  // authenticateToken,  // Temporarily disabled for development
  // requireViewer,      // Temporarily disabled for development
  validateQuery(querySchema),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    // Record metric for request
    applicationRequestCounter.add(1, {
      method: 'GET',
      endpoint: '/applications',
      status: 'started'
    });

    try {
      const { page, limit, environment, category, isActive, search } = req.query as any;
      
      logger.info('Fetching applications', {
        page,
        limit,
        environment,
        category,
        isActive,
        search,
        userId: (req as any).user?.id
      });
      
      const where: any = {};
      if (environment) where.environment = environment;
      if (category) where.category = category;
      if (isActive !== undefined) where.isActive = isActive;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { displayName: { contains: search } },
        ];
      }

      // Temporarily return mock data for development when DB is not available
      const mockApplications = [
        {
          id: '1',
          name: 'AppSentry Backend',
          description: 'Backend API service for AppSentry platform',
          healthCheckUrl: 'http://localhost:3001/health',
          environment: 'development',
          category: 'backend',
          status: 'healthy',
          team: 'Platform Team',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          creator: { id: '1', displayName: 'System' },
          lastModifier: { id: '1', displayName: 'System' },
        },
        {
          id: '2',
          name: 'AppSentry Frontend',
          description: 'React frontend application for AppSentry platform',
          healthCheckUrl: 'http://localhost:3000/health.json',
          environment: 'development',
          category: 'frontend',
          status: 'healthy',
          team: 'Platform Team',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          creator: { id: '1', displayName: 'System' },
          lastModifier: { id: '1', displayName: 'System' },
        }
      ];

      const applications = mockApplications;
      const total = mockApplications.length;

      const duration = Date.now() - startTime;
      
      // Record successful metrics
      applicationRequestCounter.add(1, {
        method: 'GET',
        endpoint: '/applications',
        status: 'success'
      });
      
      applicationRequestDuration.record(duration, {
        method: 'GET',
        endpoint: '/applications',
        status: 'success'
      });

      logger.info('Applications fetched successfully', {
        count: applications.length,
        total,
        duration: `${duration}ms`,
        userId: (req as any).user?.id
      });

      res.json({
        applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      applicationRequestCounter.add(1, {
        method: 'GET',
        endpoint: '/applications',
        status: 'error'
      });
      
      applicationRequestDuration.record(duration, {
        method: 'GET',
        endpoint: '/applications',
        status: 'error'
      });

      logger.error('Get applications error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
        userId: (req as any).user?.id
      });
      
      res.status(500).json({
        error: {
          message: 'Failed to fetch applications',
          code: 'FETCH_APPLICATIONS_FAILED',
        },
      });
    }
  },
);

// Get application by ID
router.get(
  '/:id',
  authenticateToken,
  requireViewer,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const application = await prisma.application.findUnique({
        where: { id: req.params.id },
        include: {
          creator: {
            select: { id: true, displayName: true },
          },
          lastModifier: {
            select: { id: true, displayName: true },
          },
        },
      });

      if (!application) {
        return res.status(404).json({
          error: {
            message: 'Application not found',
            code: 'APPLICATION_NOT_FOUND',
          },
        });
      }

      res.json(application);
    } catch (error) {
      logger.error('Get application error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to fetch application',
          code: 'FETCH_APPLICATION_FAILED',
        },
      });
    }
  },
);

// Create application
router.post(
  '/',
  authenticateToken,
  requireEditor,
  validate(createApplicationSchema),
  async (req: Request, res: Response) => {
    try {
      const application = await prisma.application.create({
        data: {
          ...req.body,
          createdBy: req.user!.userId,
          lastModifiedBy: req.user!.userId,
        },
        include: {
          creator: {
            select: { id: true, displayName: true },
          },
          lastModifier: {
            select: { id: true, displayName: true },
          },
        },
      });

      res.status(201).json(application);
    } catch (error: any) {
      logger.error('Create application error:', error);
      
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: {
            message: 'Application name already exists',
            code: 'DUPLICATE_APPLICATION_NAME',
          },
        });
      }

      res.status(500).json({
        error: {
          message: 'Failed to create application',
          code: 'CREATE_APPLICATION_FAILED',
        },
      });
    }
  },
);

// Update application
router.put(
  '/:id',
  authenticateToken,
  requireEditor,
  validateParams(paramSchema),
  validate(updateApplicationSchema),
  async (req: Request, res: Response) => {
    try {
      const application = await prisma.application.update({
        where: { id: req.params.id },
        data: {
          ...req.body,
          lastModifiedBy: req.user!.userId,
        },
        include: {
          creator: {
            select: { id: true, displayName: true },
          },
          lastModifier: {
            select: { id: true, displayName: true },
          },
        },
      });

      res.json(application);
    } catch (error: any) {
      logger.error('Update application error:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          error: {
            message: 'Application not found',
            code: 'APPLICATION_NOT_FOUND',
          },
        });
      }
      
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: {
            message: 'Application name already exists',
            code: 'DUPLICATE_APPLICATION_NAME',
          },
        });
      }

      res.status(500).json({
        error: {
          message: 'Failed to update application',
          code: 'UPDATE_APPLICATION_FAILED',
        },
      });
    }
  },
);

// Delete application
router.delete(
  '/:id',
  authenticateToken,
  requireEditor,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      await prisma.application.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Application deleted successfully' });
    } catch (error: any) {
      logger.error('Delete application error:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          error: {
            message: 'Application not found',
            code: 'APPLICATION_NOT_FOUND',
          },
        });
      }
      
      res.status(500).json({
        error: {
          message: 'Failed to delete application',
          code: 'DELETE_APPLICATION_FAILED',
        },
      });
    }
  },
);

export default router;