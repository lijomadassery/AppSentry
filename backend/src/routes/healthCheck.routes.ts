import { Router, Request, Response } from 'express';
import { healthCheckService } from '../services/healthCheckService';
import { logger } from '../utils/logger';
import { trace } from '@opentelemetry/api';

const router = Router();
const tracer = trace.getTracer('appsentry-health-checks', '1.0.0');

/**
 * Get health check status summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  const span = tracer.startSpan('get_health_summary');
  
  try {
    logger.info('Retrieving health check summary', {
      endpoint: '/api/health-checks/summary',
      userAgent: req.headers['user-agent'],
      clientIP: req.ip
    });

    span.setAttributes({
      'http.method': 'GET',
      'http.route': '/api/health-checks/summary',
      'operation.name': 'get_health_summary'
    });

    logger.debug('Calling health check service for summary data');
    const summary = await healthCheckService.getHealthStatusSummary();
    
    span.setAttributes({
      'health.total_apps': summary.total,
      'health.healthy_apps': summary.healthy,
      'health.unhealthy_apps': summary.unhealthy
    });

    logger.info('Health summary retrieved successfully', {
      total: summary.total,
      healthy: summary.healthy,
      unhealthy: summary.unhealthy,
      unknown: summary.unknown,
      traceId: span.spanContext().traceId
    });

    res.json({
      success: true,
      data: summary
    });

    span.setStatus({ code: 1 }); // OK

  } catch (error) {
    logger.error('Failed to get health check summary', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      endpoint: '/api/health-checks/summary'
    });
    
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get health check summary'
    });
  } finally {
    span.end();
  }
});

/**
 * Get health check history for an application
 */
router.get('/history/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const history = await healthCheckService.getHealthCheckHistory(applicationId, limit);
    
    res.json({
      success: true,
      data: {
        applicationId,
        history,
        count: history.length
      }
    });
  } catch (error) {
    logger.error('Failed to get health check history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health check history'
    });
  }
});

/**
 * Manually trigger health check for an application
 */
router.post('/trigger/:applicationId', async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params;

    const result = await healthCheckService.triggerHealthCheck(applicationId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Application not found or health check not configured'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to trigger health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger health check'
    });
  }
});

/**
 * Get health check scheduler status
 */
router.get('/scheduler/status', (req: Request, res: Response) => {
  try {
    const status = healthCheckService.getSchedulerStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

/**
 * Start health check scheduler
 */
router.post('/scheduler/start', async (req: Request, res: Response) => {
  try {
    await healthCheckService.startScheduler();
    res.json({
      success: true,
      message: 'Health check scheduler started'
    });
  } catch (error) {
    logger.error('Failed to start scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start health check scheduler'
    });
  }
});

/**
 * Stop health check scheduler
 */
router.post('/scheduler/stop', (req: Request, res: Response) => {
  try {
    healthCheckService.stopScheduler();
    res.json({
      success: true,
      message: 'Health check scheduler stopped'
    });
  } catch (error) {
    logger.error('Failed to stop scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop health check scheduler'
    });
  }
});

/**
 * Get health metrics for dashboard
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const summary = await healthCheckService.getHealthStatusSummary();
    const schedulerStatus = healthCheckService.getSchedulerStatus();

    // Calculate health percentage
    const healthPercentage = summary.total > 0 
      ? Math.round((summary.healthy / summary.total) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        summary,
        scheduler: schedulerStatus,
        metrics: {
          healthPercentage,
          totalApplications: summary.total,
          healthyApplications: summary.healthy,
          unhealthyApplications: summary.unhealthy,
          unknownApplications: summary.unknown
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get health metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health metrics'
    });
  }
});

export default router;