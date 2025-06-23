import api from './api';

export interface HealthCheckResult {
  applicationId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  timestamp: string;
  statusCode?: number;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface HealthStatusSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
}

export interface HealthMetrics {
  summary: HealthStatusSummary;
  scheduler: {
    running: boolean;
    scheduledChecks: number;
    runningChecks: number;
  };
  metrics: {
    healthPercentage: number;
    totalApplications: number;
    healthyApplications: number;
    unhealthyApplications: number;
    unknownApplications: number;
  };
}

class HealthCheckApi {
  /**
   * Get health status summary
   */
  async getHealthSummary(): Promise<HealthStatusSummary> {
    try {
      const response = await api.get('/health-checks/summary');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch health summary:', error);
      throw error;
    }
  }

  /**
   * Get health check history for an application
   */
  async getHealthHistory(applicationId: string, limit: number = 100): Promise<HealthCheckResult[]> {
    try {
      const response = await api.get(`/health-checks/history/${applicationId}`, {
        params: { limit }
      });
      return response.data.data.history;
    } catch (error) {
      console.error('Failed to fetch health history:', error);
      throw error;
    }
  }

  /**
   * Trigger manual health check for an application
   */
  async triggerHealthCheck(applicationId: string): Promise<HealthCheckResult> {
    try {
      const response = await api.post(`/health-checks/trigger/${applicationId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to trigger health check:', error);
      throw error;
    }
  }

  /**
   * Get health check scheduler status
   */
  async getSchedulerStatus(): Promise<{
    running: boolean;
    scheduledChecks: number;
    runningChecks: number;
  }> {
    try {
      const response = await api.get('/health-checks/scheduler/status');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch scheduler status:', error);
      throw error;
    }
  }

  /**
   * Start health check scheduler
   */
  async startScheduler(): Promise<void> {
    try {
      await api.post('/health-checks/scheduler/start');
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop health check scheduler
   */
  async stopScheduler(): Promise<void> {
    try {
      await api.post('/health-checks/scheduler/stop');
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive health metrics for dashboard
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    try {
      const response = await api.get('/health-checks/metrics');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch health metrics:', error);
      throw error;
    }
  }

  /**
   * Get health status for dashboard overview
   */
  async getDashboardHealth(): Promise<{
    healthPercentage: number;
    totalApplications: number;
    issues: number;
    trend: 'up' | 'down' | 'stable';
  }> {
    try {
      const metrics = await this.getHealthMetrics();
      
      // Calculate trend - for now just return stable, in real implementation
      // this would compare with previous period
      const trend: 'up' | 'down' | 'stable' = 'stable';
      
      return {
        healthPercentage: metrics.metrics.healthPercentage,
        totalApplications: metrics.metrics.totalApplications,
        issues: metrics.metrics.unhealthyApplications + metrics.metrics.unknownApplications,
        trend
      };
    } catch (error) {
      console.error('Failed to fetch dashboard health:', error);
      // Return safe defaults
      return {
        healthPercentage: 0,
        totalApplications: 0,
        issues: 0,
        trend: 'stable'
      };
    }
  }
}

export const healthCheckApi = new HealthCheckApi();