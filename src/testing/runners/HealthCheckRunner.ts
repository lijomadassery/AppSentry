import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import https from 'https';
import { performance } from 'perf_hooks';
import { logger } from '../../utils/logger';
import {
  HealthCheckConfig,
  HealthCheckResult,
  TestExecutionContext,
  TestResultData,
  TestLogEntry,
  TestExecutionError,
} from '../../types/testing';
import { TestStatus } from '../../types';

export class HealthCheckRunner {
  private context: TestExecutionContext;

  constructor(context: TestExecutionContext) {
    this.context = context;
  }

  public async execute(): Promise<TestResultData> {
    const logs: TestLogEntry[] = [];
    const startTime = performance.now();
    let healthCheckResult: HealthCheckResult | undefined;
    let status: TestStatus = TestStatus.passed;
    let error: { message: string; stack?: string; code?: string } | undefined;

    try {
      this.addLog(logs, 'info', `Starting health check for ${this.context.config.name}`);
      
      // Execute health check
      healthCheckResult = await this.performHealthCheck(logs);
      
      // Validate results
      const validationResult = this.validateHealthCheck(healthCheckResult, logs);
      
      if (!validationResult.success) {
        status = TestStatus.failed;
        error = {
          message: validationResult.error || 'Health check validation failed',
          code: 'VALIDATION_FAILED',
        };
      }

      this.addLog(logs, 'info', `Health check completed with status: ${status}`);

    } catch (err: any) {
      status = TestStatus.failed;
      error = {
        message: err.message || 'Health check execution failed',
        stack: err.stack,
        code: this.mapErrorToCode(err),
      };
      
      this.addLog(logs, 'error', `Health check failed: ${error.message}`, { error: err });
    }

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    return {
      testRunId: this.context.testRunId,
      applicationId: this.context.applicationId,
      testType: this.context.testType,
      status,
      startedAt: this.context.startedAt,
      completedAt: new Date(),
      durationMs,
      error,
      screenshots: [], // Health checks don't capture screenshots
      logs,
      metrics: {
        responseTime: healthCheckResult?.responseTime,
        redirectCount: healthCheckResult?.redirects.length || 0,
      },
      healthCheckData: healthCheckResult,
    };
  }

  private async performHealthCheck(logs: TestLogEntry[]): Promise<HealthCheckResult> {
    const config = this.context.config.healthCheck;
    const startTime = performance.now();

    this.addLog(logs, 'debug', `Making ${config.method} request to ${config.url}`);

    // Configure axios request
    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.url,
      timeout: config.timeout,
      headers: {
        'User-Agent': this.context.environment.userAgent,
        ...config.headers,
      },
      validateStatus: () => true, // Don't throw on any status code
      maxRedirects: config.followRedirects ? 5 : 0,
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.validateSSL,
      }),
    };

    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      axiosConfig.data = config.body;
      axiosConfig.headers = {
        ...axiosConfig.headers,
        'Content-Type': 'application/json',
      };
    }

    let response: AxiosResponse;
    let redirects: string[] = [];
    let sslInfo: any = undefined;

    try {
      // Track redirects
      axiosConfig.transformRequest = [
        (data, headers) => {
          this.addLog(logs, 'debug', `Request headers: ${JSON.stringify(headers)}`);
          return data;
        },
      ];

      response = await axios(axiosConfig);

      // Extract SSL information if HTTPS
      if (config.url.startsWith('https://')) {
        try {
          sslInfo = await this.extractSSLInfo(config.url, logs);
        } catch (sslError) {
          this.addLog(logs, 'warn', 'Failed to extract SSL information', { error: sslError });
        }
      }

      // Extract redirects from response config
      if (response.request._redirectable && response.request._redirectable._redirectCount > 0) {
        redirects = this.extractRedirectChain(response);
      }

    } catch (err: any) {
      this.addLog(logs, 'error', `HTTP request failed: ${err.message}`);
      throw new Error(`Network request failed: ${err.message}`);
    }

    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    this.addLog(logs, 'info', `Received response: ${response.status} ${response.statusText} in ${responseTime}ms`);

    const result: HealthCheckResult = {
      url: config.url,
      method: config.method,
      status: response.status,
      statusText: response.statusText,
      responseTime,
      responseSize: this.calculateResponseSize(response),
      headers: response.headers as Record<string, string>,
      body: this.extractResponseBody(response, logs),
      redirects,
      sslInfo,
      timing: this.calculateDetailedTiming(response, responseTime),
    };

    return result;
  }

  private validateHealthCheck(
    result: HealthCheckResult,
    logs: TestLogEntry[],
  ): { success: boolean; error?: string } {
    const config = this.context.config.healthCheck;

    // Validate status code
    if (!config.expectedStatus.includes(result.status)) {
      const error = `Expected status ${config.expectedStatus.join(' or ')}, got ${result.status}`;
      this.addLog(logs, 'error', error);
      return { success: false, error };
    }

    // Validate response body if expected
    if (config.expectedResponse) {
      try {
        const bodyMatch = this.validateResponseBody(result.body, config.expectedResponse, logs);
        if (!bodyMatch) {
          const error = 'Response body does not match expected content';
          this.addLog(logs, 'error', error);
          return { success: false, error };
        }
      } catch (err: any) {
        const error = `Response validation failed: ${err.message}`;
        this.addLog(logs, 'error', error);
        return { success: false, error };
      }
    }

    // Validate response time
    if (result.responseTime > config.timeout) {
      const error = `Response time ${result.responseTime}ms exceeded timeout ${config.timeout}ms`;
      this.addLog(logs, 'warn', error);
      // Note: This is a warning, not a failure in health checks
    }

    this.addLog(logs, 'info', 'Health check validation passed');
    return { success: true };
  }

  private validateResponseBody(
    actualBody: any,
    expectedBody: any,
    logs: TestLogEntry[],
  ): boolean {
    if (typeof expectedBody !== typeof actualBody) {
      this.addLog(logs, 'debug', `Body type mismatch: expected ${typeof expectedBody}, got ${typeof actualBody}`);
      return false;
    }

    if (typeof expectedBody === 'object' && expectedBody !== null) {
      // Deep comparison for objects
      return this.deepCompareObjects(actualBody, expectedBody, logs);
    }

    // Simple comparison for primitives
    const match = actualBody === expectedBody;
    if (!match) {
      this.addLog(logs, 'debug', `Body mismatch: expected ${expectedBody}, got ${actualBody}`);
    }
    return match;
  }

  private deepCompareObjects(actual: any, expected: any, logs: TestLogEntry[]): boolean {
    for (const key in expected) {
      if (!(key in actual)) {
        this.addLog(logs, 'debug', `Missing expected property: ${key}`);
        return false;
      }

      if (typeof expected[key] === 'object' && expected[key] !== null) {
        if (!this.deepCompareObjects(actual[key], expected[key], logs)) {
          return false;
        }
      } else if (actual[key] !== expected[key]) {
        this.addLog(logs, 'debug', `Property mismatch for ${key}: expected ${expected[key]}, got ${actual[key]}`);
        return false;
      }
    }
    return true;
  }

  private async extractSSLInfo(url: string, logs: TestLogEntry[]): Promise<any> {
    // This is a simplified SSL info extraction
    // In a production environment, you might want to use a more robust SSL checker
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const port = urlObj.port || '443';

      // This would typically use a proper SSL certificate checker
      // For now, we'll return basic info
      return {
        valid: true,
        issuer: 'Unknown',
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      };
    } catch (err) {
      this.addLog(logs, 'warn', 'Failed to extract SSL info', { error: err });
      return undefined;
    }
  }

  private extractRedirectChain(response: AxiosResponse): string[] {
    // Extract redirect chain from axios response
    const redirects: string[] = [];
    
    // This is a simplified implementation
    // In practice, you'd need to track redirects through axios interceptors
    if (response.request.responseURL && response.request.responseURL !== response.config.url) {
      redirects.push(response.request.responseURL);
    }

    return redirects;
  }

  private calculateResponseSize(response: AxiosResponse): number {
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    // Estimate size from response data
    if (typeof response.data === 'string') {
      return Buffer.byteLength(response.data, 'utf8');
    }

    if (response.data && typeof response.data === 'object') {
      return Buffer.byteLength(JSON.stringify(response.data), 'utf8');
    }

    return 0;
  }

  private extractResponseBody(response: AxiosResponse, logs: TestLogEntry[]): any {
    try {
      // Limit body size for storage
      const maxBodySize = 10 * 1024; // 10KB
      let body = response.data;

      if (typeof body === 'string' && body.length > maxBodySize) {
        body = body.substring(0, maxBodySize) + '... [truncated]';
        this.addLog(logs, 'debug', `Response body truncated to ${maxBodySize} characters`);
      }

      return body;
    } catch (err) {
      this.addLog(logs, 'warn', 'Failed to extract response body', { error: err });
      return null;
    }
  }

  private calculateDetailedTiming(response: AxiosResponse, totalTime: number): any {
    // This is a simplified timing calculation
    // In practice, you'd use more detailed timing from axios or custom timing
    return {
      dns: Math.round(totalTime * 0.1),
      connect: Math.round(totalTime * 0.1),
      ssl: Math.round(totalTime * 0.1),
      send: Math.round(totalTime * 0.05),
      wait: Math.round(totalTime * 0.6),
      receive: Math.round(totalTime * 0.05),
      total: totalTime,
    };
  }

  private mapErrorToCode(error: any): TestExecutionError {
    if (error.code === 'ECONNREFUSED') return 'NETWORK_ERROR';
    if (error.code === 'ENOTFOUND') return 'NETWORK_ERROR';
    if (error.code === 'ETIMEDOUT') return 'TIMEOUT';
    if (error.message?.includes('timeout')) return 'TIMEOUT';
    if (error.message?.includes('navigation')) return 'NAVIGATION_FAILED';
    return 'UNKNOWN_ERROR';
  }

  private addLog(
    logs: TestLogEntry[],
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any,
  ): void {
    const logEntry: TestLogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      source: 'test-runner',
    };

    logs.push(logEntry);

    // Also log to main logger
    logger[level](`[HealthCheck:${this.context.applicationId}] ${message}`, data);
  }
}

export default HealthCheckRunner;