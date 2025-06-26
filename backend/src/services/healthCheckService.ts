import { logger } from '../utils/logger';
import { clickHouseService } from './clickhouseService';
import axios from 'axios';

export interface HealthCheckResult {
  applicationId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
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
            timeout: app.health_check_timeout || 5000,
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
        status: 'unknown',
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

      // Store result in ClickHouse
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

      // Store result in ClickHouse
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
   * Store health check result in ClickHouse
   */
  private async storeHealthCheckResult(result: HealthCheckResult): Promise<void> {
    try {
      const query = `
        INSERT INTO appsentry.health_checks (
          application_id, status, response_time_ms, check_time, 
          status_code, error_message, details
        ) VALUES (
          '${result.applicationId}', '${result.status}', ${result.responseTime}, 
          '${result.timestamp.toISOString()}', ${result.statusCode || 0}, 
          '${this.escapeString(result.errorMessage || '')}', 
          '${this.escapeString(JSON.stringify(result.details || {}))}'
        )
      `;

      await clickHouseService.query(query);
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
      const lastHealthCheck = new Date().toISOString();
      const query = `
        ALTER TABLE appsentry.applications 
        UPDATE 
          last_check_time = '${lastHealthCheck}',
          status = '${status}'
        WHERE id = '${applicationId}'
      `;

      await clickHouseService.query(query);
    } catch (error) {
      logger.error('Failed to update application status:', error);
    }
  }

  /**
   * Get registered applications from ClickHouse
   */
  private async getRegisteredApplications(): Promise<any[]> {
    try {
      const query = `
        SELECT id, name, health_check_url, health_check_interval, 
               health_check_timeout, active as enabled
        FROM appsentry.applications 
        WHERE active = true AND health_check_url != ''
      `;

      const result = await clickHouseService.query(query);
      return result || [];
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
      const query = `
        SELECT application_id, status, response_time_ms, check_time, 
               status_code, error_message, details
        FROM appsentry.health_checks 
        WHERE application_id = '${applicationId}'
        ORDER BY check_time DESC 
        LIMIT ${limit}
      `;

      const result = await clickHouseService.query(query);
      return (result || []).map((row: any) => ({
        applicationId: row.application_id,
        status: row.status,
        responseTime: row.response_time_ms,
        timestamp: new Date(row.check_time),
        statusCode: row.status_code || undefined,
        errorMessage: row.error_message || undefined,
        details: row.details ? JSON.parse(row.details) : undefined
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
    unknown: number;
  }> {
    try {
      const query = `
        SELECT status, COUNT(*) as count
        FROM appsentry.applications 
        WHERE active = true
        GROUP BY status
      `;

      const result = await clickHouseService.query(query);
      const summary = { total: 0, healthy: 0, unhealthy: 0, unknown: 0 };

      (result || []).forEach((row: any) => {
        const status = row.status || 'unknown';
        const count = parseInt(row.count, 10);
        
        summary.total += count;
        if (status === 'healthy') summary.healthy += count;
        else if (status === 'unhealthy') summary.unhealthy += count;
        else summary.unknown += count;
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get health status summary:', error);
      return { total: 0, healthy: 0, unhealthy: 0, unknown: 0 };
    }
  }

  /**
   * Manually trigger health check for an application
   */
  public async triggerHealthCheck(applicationId: string): Promise<HealthCheckResult | null> {
    try {
      // Get application details
      const query = `
        SELECT id, name, health_check_url, health_check_timeout
        FROM appsentry.applications 
        WHERE id = '${applicationId}' AND active = true
      `;

      const result = await clickHouseService.query(query);
      const app = result?.[0];

      if (!app || !app.health_check_url) {
        throw new Error('Application not found or health check URL not configured');
      }

      const config: HealthCheckConfig = {
        id: app.id,
        name: app.name,
        url: app.health_check_url,
        method: 'GET',
        timeout: app.health_check_timeout || 5000,
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
   * Escape string for ClickHouse queries
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
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