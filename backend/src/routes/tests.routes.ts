import { Router, Request, Response } from 'express';
import { authenticateToken, requireEditor, requireViewer } from '../middlewares/auth';
import { validate, validateQuery, validateParams } from '../middlewares/validation';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';
import TestOrchestrator from '../testing/orchestration/TestOrchestrator';
import ArtifactStorage from '../testing/artifacts/ArtifactStorage';
import { TriggerType, TestRunStatus } from '../types';
import Joi from 'joi';

const router = Router();

// Global test orchestrator instance
const testOrchestrator = new TestOrchestrator();
const artifactStorage = new ArtifactStorage();

// Validation schemas
const runTestsSchema = Joi.object({
  applications: Joi.array().items(Joi.string().uuid()).min(1).required(),
  triggerSource: Joi.string().optional(),
});

const runAppTestSchema = Joi.object({
  applicationId: Joi.string().uuid().required(),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...Object.values(TestRunStatus)).optional(),
  triggerType: Joi.string().valid(...Object.values(TriggerType)).optional(),
  applicationId: Joi.string().uuid().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

const paramSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

// Run tests for all applications
router.post(
  '/run-all',
  authenticateToken,
  requireEditor,
  async (req: Request, res: Response) => {
    try {
      logger.info(`Starting test run for all applications - triggered by ${req.user!.userId}`);

      // Get all active applications
      const applications = await prisma.application.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (applications.length === 0) {
        return res.status(400).json({
          error: {
            message: 'No active applications found',
            code: 'NO_APPLICATIONS',
          },
        });
      }

      const applicationIds = applications.map(app => app.id);
      
      const testRunId = await testOrchestrator.startTestRun(
        applicationIds,
        TriggerType.manual,
        req.user!.userId,
        'web-ui',
      );

      res.json({
        testRunId,
        message: `Started test run for ${applicationIds.length} applications`,
        applications: applicationIds.length,
      });

    } catch (error) {
      logger.error('Run all tests error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to start test run',
          code: 'TEST_RUN_START_FAILED',
        },
      });
    }
  },
);

// Run tests for specific applications
router.post(
  '/run-apps',
  authenticateToken,
  requireEditor,
  validate(runTestsSchema),
  async (req: Request, res: Response) => {
    try {
      const { applications, triggerSource } = req.body;

      logger.info(`Starting test run for ${applications.length} applications - triggered by ${req.user!.userId}`);

      // Verify all applications exist and are active
      const existingApps = await prisma.application.findMany({
        where: {
          id: { in: applications },
          isActive: true,
        },
        select: { id: true, name: true },
      });

      if (existingApps.length !== applications.length) {
        const missingApps = applications.filter(
          (id: string) => !existingApps.find(app => app.id === id)
        );
        
        return res.status(400).json({
          error: {
            message: 'Some applications not found or inactive',
            code: 'INVALID_APPLICATIONS',
            details: { missingApplications: missingApps },
          },
        });
      }

      const testRunId = await testOrchestrator.startTestRun(
        applications,
        TriggerType.manual,
        req.user!.userId,
        triggerSource || 'web-ui',
      );

      res.json({
        testRunId,
        message: `Started test run for ${applications.length} applications`,
        applications: existingApps.map(app => ({ id: app.id, name: app.name })),
      });

    } catch (error) {
      logger.error('Run apps tests error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to start test run',
          code: 'TEST_RUN_START_FAILED',
        },
      });
    }
  },
);

// Run test for a specific application
router.post(
  '/:id/test',
  authenticateToken,
  requireEditor,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const applicationId = req.params.id;

      // Verify application exists and is active
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { id: true, name: true, isActive: true },
      });

      if (!application) {
        return res.status(404).json({
          error: {
            message: 'Application not found',
            code: 'APPLICATION_NOT_FOUND',
          },
        });
      }

      if (!application.isActive) {
        return res.status(400).json({
          error: {
            message: 'Application is not active',
            code: 'APPLICATION_INACTIVE',
          },
        });
      }

      logger.info(`Starting test run for application ${application.name} - triggered by ${req.user!.userId}`);

      const testRunId = await testOrchestrator.startTestRun(
        [applicationId],
        TriggerType.manual,
        req.user!.userId,
        'web-ui',
      );

      res.json({
        testRunId,
        message: `Started test run for application ${application.name}`,
        application: {
          id: application.id,
          name: application.name,
        },
      });

    } catch (error) {
      logger.error('Run app test error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to start test run',
          code: 'TEST_RUN_START_FAILED',
        },
      });
    }
  },
);

// Get test run status
router.get(
  '/status/:id',
  authenticateToken,
  requireViewer,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const testRunId = req.params.id;

      const status = await testOrchestrator.getTestRunStatus(testRunId);

      if (!status) {
        return res.status(404).json({
          error: {
            message: 'Test run not found',
            code: 'TEST_RUN_NOT_FOUND',
          },
        });
      }

      res.json(status);

    } catch (error) {
      logger.error('Get test status error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get test run status',
          code: 'GET_STATUS_FAILED',
        },
      });
    }
  },
);

// Get test run history
router.get(
  '/history',
  authenticateToken,
  requireViewer,
  validateQuery(querySchema),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, status, triggerType, applicationId, startDate, endDate } = req.query as any;

      const where: any = {};
      if (status) where.status = status;
      if (triggerType) where.triggerType = triggerType;
      if (startDate || endDate) {
        where.startedAt = {};
        if (startDate) where.startedAt.gte = new Date(startDate);
        if (endDate) where.startedAt.lte = new Date(endDate);
      }
      if (applicationId) {
        where.applications = { has: applicationId };
      }

      const skip = (page - 1) * limit;

      const [testRuns, total] = await Promise.all([
        prisma.testRun.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startedAt: 'desc' },
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
            testResults: {
              select: {
                id: true,
                status: true,
                testType: true,
                applicationId: true,
                durationMs: true,
              },
            },
          },
        }),
        prisma.testRun.count({ where }),
      ]);

      res.json({
        testRuns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });

    } catch (error) {
      logger.error('Get test history error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get test history',
          code: 'GET_HISTORY_FAILED',
        },
      });
    }
  },
);

// Get specific test run details
router.get(
  '/:id',
  authenticateToken,
  requireViewer,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const testRun = await prisma.testRun.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: { id: true, displayName: true, email: true },
          },
          testResults: {
            include: {
              application: {
                select: { id: true, name: true, displayName: true },
              },
            },
            orderBy: { startedAt: 'asc' },
          },
        },
      });

      if (!testRun) {
        return res.status(404).json({
          error: {
            message: 'Test run not found',
            code: 'TEST_RUN_NOT_FOUND',
          },
        });
      }

      res.json(testRun);

    } catch (error) {
      logger.error('Get test run error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get test run',
          code: 'GET_TEST_RUN_FAILED',
        },
      });
    }
  },
);

// Get test result logs
router.get(
  '/:id/logs',
  authenticateToken,
  requireViewer,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const testResult = await prisma.testResult.findUnique({
        where: { id: BigInt(req.params.id) },
        select: {
          id: true,
          logsUrl: true,
          testRun: {
            select: { id: true },
          },
          application: {
            select: { id: true, name: true },
          },
        },
      });

      if (!testResult) {
        return res.status(404).json({
          error: {
            message: 'Test result not found',
            code: 'TEST_RESULT_NOT_FOUND',
          },
        });
      }

      // If logs are stored as a URL/path, try to retrieve them
      if (testResult.logsUrl) {
        try {
          const logsBuffer = await artifactStorage.downloadArtifact(testResult.logsUrl);
          const logs = JSON.parse(logsBuffer.toString());
          res.json({ logs });
        } catch (error) {
          logger.warn(`Failed to retrieve logs for test result ${testResult.id}: ${error}`);
          res.json({ logs: [], message: 'Logs not available' });
        }
      } else {
        res.json({ logs: [], message: 'No logs available for this test result' });
      }

    } catch (error) {
      logger.error('Get test logs error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get test logs',
          code: 'GET_LOGS_FAILED',
        },
      });
    }
  },
);

// Cancel test run
router.delete(
  '/:id',
  authenticateToken,
  requireEditor,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const testRunId = req.params.id;

      // Check if test run exists and is cancellable
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        select: { id: true, status: true },
      });

      if (!testRun) {
        return res.status(404).json({
          error: {
            message: 'Test run not found',
            code: 'TEST_RUN_NOT_FOUND',
          },
        });
      }

      if (testRun.status === TestRunStatus.completed || testRun.status === TestRunStatus.cancelled) {
        return res.status(400).json({
          error: {
            message: 'Test run cannot be cancelled',
            code: 'TEST_RUN_NOT_CANCELLABLE',
          },
        });
      }

      await testOrchestrator.stopTestRun(testRunId);

      logger.info(`Test run ${testRunId} cancelled by ${req.user!.userId}`);

      res.json({
        message: 'Test run cancelled successfully',
        testRunId,
      });

    } catch (error) {
      logger.error('Cancel test run error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to cancel test run',
          code: 'CANCEL_TEST_RUN_FAILED',
        },
      });
    }
  },
);

// Retry failed tests
router.post(
  '/:id/retry',
  authenticateToken,
  requireEditor,
  validateParams(paramSchema),
  async (req: Request, res: Response) => {
    try {
      const originalTestRunId = req.params.id;

      // Get the original test run with failed applications
      const originalTestRun = await prisma.testRun.findUnique({
        where: { id: originalTestRunId },
        include: {
          testResults: {
            where: { status: 'failed' },
            select: { applicationId: true },
          },
        },
      });

      if (!originalTestRun) {
        return res.status(404).json({
          error: {
            message: 'Test run not found',
            code: 'TEST_RUN_NOT_FOUND',
          },
        });
      }

      const failedApplicationIds = [...new Set(originalTestRun.testResults.map(r => r.applicationId))];

      if (failedApplicationIds.length === 0) {
        return res.status(400).json({
          error: {
            message: 'No failed tests to retry',
            code: 'NO_FAILED_TESTS',
          },
        });
      }

      // Start new test run for failed applications
      const newTestRunId = await testOrchestrator.startTestRun(
        failedApplicationIds,
        TriggerType.manual,
        req.user!.userId,
        `retry-${originalTestRunId}`,
      );

      logger.info(`Started retry test run ${newTestRunId} for ${failedApplicationIds.length} failed applications`);

      res.json({
        testRunId: newTestRunId,
        originalTestRunId,
        message: `Started retry for ${failedApplicationIds.length} failed applications`,
        retriedApplications: failedApplicationIds.length,
      });

    } catch (error) {
      logger.error('Retry test run error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to retry test run',
          code: 'RETRY_TEST_RUN_FAILED',
        },
      });
    }
  },
);

export default router;