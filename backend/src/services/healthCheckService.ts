import { logger } from '../utils/logger';
import { prisma } from '../database/prisma';
import axios from 'axios';
import { Prisma } from '@prisma/client';

export interface HealthCheckResult {
  applicationId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: Date;
  statusCode?: number;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface HealthCheckConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  timeout: number;
  interval: number; // in seconds
  retryCount: number;
  expectedStatusCodes: number[];
  headers?: Record<string, string>;
  body?: string;
  enabled: boolean;
}

class HealthCheckService {
  private scheduledChecks: Map<string, NodeJS.Timeout> = new Map();
  private runningChecks: Set<string> = new Set();

  /**
   * Start health check scheduler for all registered applications
   */
  public async startScheduler(): Promise<void> {
    try {
      logger.info('Starting health check scheduler...');
      
      // Get all registered applications
      const applications = await this.getRegisteredApplications();
      
      for (const app of applications) {
        if (app.enabled && app.health_check_url) {
          await this.scheduleHealthCheck({
            id: app.id,
            name: app.name,
            url: app.health_check_url,
            method: 'GET',
            timeout: (app.health_check_timeout || 30) * 1000,
            interval: app.health_check_interval || 60, // Default 60 seconds
            retryCount: 3,
            expectedStatusCodes: [200, 201, 204],
            enabled: true
          });
        }
      }
      
      logger.info(`Health check scheduler started for ${applications.length} applications`);
    } catch (error) {
      logger.error('Failed to start health check scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop health check scheduler
   */
  public stopScheduler(): void {
    logger.info('Stopping health check scheduler...');
    
    this.scheduledChecks.forEach((timeout, appId) => {
      clearInterval(timeout);
      logger.debug(`Stopped health check for application: ${appId}`);
    });
    
    this.scheduledChecks.clear();
    this.runningChecks.clear();
    
    logger.info('Health check scheduler stopped');
  }

  /**
   * Schedule health check for a specific application
   */
  public async scheduleHealthCheck(config: HealthCheckConfig): Promise<void> {
    // Stop existing check if running
    if (this.scheduledChecks.has(config.id)) {
      this.stopHealthCheck(config.id);
    }

    if (!config.enabled) {
      logger.debug(`Health check disabled for application: ${config.name}`);
      return;
    }

    logger.info(`Scheduling health check for ${config.name} every ${config.interval}s`);

    // Run initial check immediately
    await this.performHealthCheck(config);

    // Schedule recurring checks
    const intervalMs = config.interval * 1000;
    const intervalId = setInterval(async () => {
      await this.performHealthCheck(config);
    }, intervalMs);

    this.scheduledChecks.set(config.id, intervalId);
  }

  /**
   * Stop health check for a specific application
   */
  public stopHealthCheck(applicationId: string): void {
    const intervalId = this.scheduledChecks.get(applicationId);
    if (intervalId) {
      clearInterval(intervalId);
      this.scheduledChecks.delete(applicationId);
      this.runningChecks.delete(applicationId);
      logger.debug(`Stopped health check for application: ${applicationId}`);
    }
  }

  /**
   * Perform health check for an application
   */
  private async performHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
    // Prevent concurrent checks for the same application
    if (this.runningChecks.has(config.id)) {
      logger.debug(`Health check already running for ${config.name}, skipping...`);
      return {
        applicationId: config.id,
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        errorMessage: 'Check already in progress'
      };
    }

    this.runningChecks.add(config.id);
    const startTime = Date.now();

    try {
      logger.debug(`Performing health check for ${config.name}: ${config.url}`);

      const response = await axios({
        method: config.method,
        url: config.url,
        timeout: config.timeout,
        headers: {
          'User-Agent': 'AppSentry-HealthCheck/1.0',
          ...config.headers
        },
        data: config.body,
        validateStatus: (status) => status < 600 // Don't throw on HTTP errors
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = config.expectedStatusCodes.includes(response.status);

      const result: HealthCheckResult = {
        applicationId: config.id,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: new Date(),
        statusCode: response.status,
        details: {
          headers: response.headers,
          dataSize: JSON.stringify(response.data).length
        }
      };

      if (!isHealthy) {
        result.errorMessage = `Unexpected status code: ${response.status}`;
      }

      // Store result in MySQL
      await this.storeHealthCheckResult(result);

      // Update application status
      await this.updateApplicationStatus(config.id, result.status, result.errorMessage);

      logger.debug(`Health check completed for ${config.name}: ${result.status} (${responseTime}ms)`);
      return result;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        applicationId: config.id,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        errorMessage: error.message || 'Unknown error',
        details: {
          errorCode: error.code,
          errorType: error.constructor.name
        }
      };

      // Store result in MySQL
      await this.storeHealthCheckResult(result);

      // Update application status
      await this.updateApplicationStatus(config.id, 'unhealthy', result.errorMessage);

      logger.warn(`Health check failed for ${config.name}: ${result.errorMessage} (${responseTime}ms)`);
      return result;

    } finally {
      this.runningChecks.delete(config.id);
    }
  }

  /**
   * Store health check result in MySQL
   */
  private async storeHealthCheckResult(result: HealthCheckResult): Promise<void> {
    try {
      await prisma.healthCheck.create({
        data: {
          application_id: result.applicationId,
          status: result.status,
          response_time_ms: result.responseTime,
          check_time: result.timestamp,
          status_code: result.statusCode || null,
          error_message: result.errorMessage || null,
          details: result.details ? JSON.stringify(result.details) : null
        }
      });
    } catch (error) {
      logger.error('Failed to store health check result:', error);
    }
  }

  /**
   * Update application status in registry
   */
  private async updateApplicationStatus(
    applicationId: string, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: status as 'healthy' | 'unhealthy' | 'degraded',
          last_check_time: new Date(),
          updated_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update application status:', error);
    }
  }

  /**
   * Get registered applications from MySQL
   */
  private async getRegisteredApplications(): Promise<any[]> {
    try {
      const applications = await prisma.application.findMany({
        where: {
          active: true,
          health_check_url: {
            not: null,
            not: ''
          }
        },
        select: {
          id: true,
          name: true,
          health_check_url: true,
          health_check_interval: true,
          health_check_timeout: true,
          active: true
        }
      });

      return applications.map(app => ({
        id: app.id,
        name: app.name,
        health_check_url: app.health_check_url!,
        health_check_interval: app.health_check_interval || 60,
        health_check_timeout: app.health_check_timeout || 30,
        enabled: app.active
      }));
    } catch (error) {
      logger.error('Failed to get registered applications:', error);
      return [];
    }
  }

  /**
   * Get health check history for an application
   */
  public async getHealthCheckHistory(
    applicationId: string, 
    limit: number = 100
  ): Promise<HealthCheckResult[]> {
    try {
      const healthChecks = await prisma.healthCheck.findMany({
        where: { application_id: applicationId },
        orderBy: { check_time: 'desc' },
        take: limit
      });

      return healthChecks.map(check => ({
        applicationId: check.application_id,
        status: check.status as 'healthy' | 'unhealthy' | 'degraded',
        responseTime: check.response_time_ms,
        timestamp: check.check_time,
        statusCode: check.status_code || undefined,
        errorMessage: check.error_message || undefined,
        details: check.details ? JSON.parse(check.details) : undefined
      }));
    } catch (error) {
      logger.error('Failed to get health check history:', error);
      return [];
    }
  }

  /**
   * Get current health status summary
   */
  public async getHealthStatusSummary(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  }> {
    try {
      const statusCounts = await prisma.application.groupBy({
        by: ['status'],
        where: { isActive: true },
        _count: true
      });

      const summary = { total: 0, healthy: 0, unhealthy: 0, degraded: 0 };

      statusCounts.forEach(row => {
        const count = row._count;
        summary.total += count;
        
        switch (row.status) {
          case 'healthy':
            summary.healthy += count;
            break;
          case 'unhealthy':
            summary.unhealthy += count;
            break;
          case 'degraded':
            summary.degraded += count;
            break;
          default:
            // Should not happen with proper enum validation
            summary.unhealthy += count;
            break;
        }
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get health status summary:', error);
      return { total: 0, healthy: 0, unhealthy: 0, degraded: 0 };
    }
  }

  /**
   * Manually trigger health check for an application
   */
  public async triggerHealthCheck(applicationId: string): Promise<HealthCheckResult | null> {
    try {
      const app = await prisma.application.findFirst({
        where: {
          id: applicationId,
          active: true
        },
        select: {
          id: true,
          name: true,
          health_check_url: true,
          health_check_timeout: true
        }
      });

      if (!app || !app.health_check_url) {
        throw new Error('Application not found or health check URL not configured');
      }

      const config: HealthCheckConfig = {
        id: app.id,
        name: app.name,
        url: app.health_check_url,
        method: 'GET',
        timeout: (app.health_check_timeout || 30) * 1000,
        interval: 60,
        retryCount: 1,
        expectedStatusCodes: [200, 201, 204],
        enabled: true
      };

      return await this.performHealthCheck(config);
    } catch (error) {
      logger.error(`Failed to trigger health check for ${applicationId}:`, error);
      return null;
    }
  }

  /**
   * Get scheduler status
   */
  public getSchedulerStatus(): {
    running: boolean;
    scheduledChecks: number;
    runningChecks: number;
  } {
    return {
      running: this.scheduledChecks.size > 0,
      scheduledChecks: this.scheduledChecks.size,
      runningChecks: this.runningChecks.size
    };
  }
}

export const healthCheckService = new HealthCheckService();