import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { config } from '../../config/env';
import { prisma } from '../../database/prisma';
import { redisClient } from '../../database/redis';
import HealthCheckRunner from '../runners/HealthCheckRunner';
import LoginTestRunner from '../runners/LoginTestRunner';
import {
  TestExecutionContext,
  TestResultData,
  TestQueueItem,
  TestOrchestrationStatus,
  ApplicationTestConfig,
  TestConfig,
} from '../../types/testing';
import {
  TestRun,
  TestRunStatus,
  TriggerType,
  TestType,
  TestStatus,
  Application,
} from '../../types';

export class TestOrchestrator extends EventEmitter {
  private readonly maxConcurrency: number;
  private readonly runningTests: Map<string, Promise<TestResultData>> = new Map();
  private readonly testQueue: TestQueueItem[] = [];
  private isProcessing = false;

  constructor(maxConcurrency?: number) {
    super();
    this.maxConcurrency = maxConcurrency || config.testing.parallelTestLimit;
  }

  public async startTestRun(
    applicationIds: string[],
    triggerType: TriggerType,
    triggeredBy?: string,
    triggerSource?: string,
  ): Promise<string> {
    const testRunId = uuidv4();

    try {
      logger.info(`Starting test run ${testRunId} for ${applicationIds.length} applications`);

      // Create test run record
      const testRun = await prisma.testRun.create({
        data: {
          id: testRunId,
          triggerType,
          triggerSource,
          triggeredBy,
          applications: applicationIds,
          status: TestRunStatus.pending,
          progressTotal: applicationIds.length * 2, // Health check + login test per app
          progressCompleted: 0,
        },
      });

      // Queue tests for each application
      await this.queueApplicationTests(testRunId, applicationIds);

      // Start processing queue
      this.processQueue();

      // Emit start event
      this.emit('testRunStarted', { testRunId, applicationIds });

      return testRunId;

    } catch (error) {
      logger.error(`Failed to start test run: ${error}`);
      throw error;
    }
  }

  public async stopTestRun(testRunId: string): Promise<void> {
    logger.info(`Stopping test run ${testRunId}`);

    try {
      // Update test run status
      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status: TestRunStatus.cancelled,
          completedAt: new Date(),
        },
      });

      // Remove pending tests from queue
      this.removeTestsFromQueue(testRunId);

      // Cancel running tests (they will complete but won't be processed)
      this.emit('testRunCancelled', { testRunId });

      logger.info(`Test run ${testRunId} stopped`);

    } catch (error) {
      logger.error(`Failed to stop test run ${testRunId}: ${error}`);
      throw error;
    }
  }

  public async getTestRunStatus(testRunId: string): Promise<TestOrchestrationStatus | null> {
    try {
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          testResults: true,
        },
      });

      if (!testRun) {
        return null;
      }

      const queuedTests = this.testQueue.filter(item => item.testRunId === testRunId);
      const runningTestIds = Array.from(this.runningTests.keys())
        .filter(key => key.startsWith(testRunId));

      const status: TestOrchestrationStatus = {
        testRunId,
        status: testRun.status,
        progress: {
          total: testRun.progressTotal,
          completed: testRun.progressCompleted,
          failed: testRun.testResults.filter(r => r.status === TestStatus.failed).length,
          running: runningTestIds.length,
          pending: queuedTests.length,
        },
        startedAt: testRun.startedAt,
        estimatedCompletion: this.calculateEstimatedCompletion(testRun),
        runningTests: [], // Would populate with actual running contexts
        queuedTests,
        completedTests: [], // Would populate with result data
      };

      return status;

    } catch (error) {
      logger.error(`Failed to get test run status: ${error}`);
      return null;
    }
  }

  private async queueApplicationTests(testRunId: string, applicationIds: string[]): Promise<void> {
    logger.debug(`Queueing tests for ${applicationIds.length} applications`);

    for (const applicationId of applicationIds) {
      try {
        // Get application configuration
        const application = await prisma.application.findUnique({
          where: { id: applicationId },
        });

        if (!application || !application.isActive) {
          logger.warn(`Skipping inactive or missing application: ${applicationId}`);
          continue;
        }

        const testConfig = this.buildApplicationTestConfig(application);

        // Queue health check test
        if (testConfig.healthCheck) {
          const healthCheckItem: TestQueueItem = {
            id: uuidv4(),
            testRunId,
            applicationId,
            testType: TestType.health_check,
            priority: this.getPriority(testConfig.metadata.priority),
            createdAt: new Date(),
            config: testConfig,
            retryCount: 0,
            maxRetries: 1,
          };

          this.testQueue.push(healthCheckItem);
        }

        // Queue login test if enabled
        if (testConfig.loginTest.enabled) {
          const loginTestItem: TestQueueItem = {
            id: uuidv4(),
            testRunId,
            applicationId,
            testType: TestType.login_test,
            priority: this.getPriority(testConfig.metadata.priority),
            createdAt: new Date(),
            config: testConfig,
            retryCount: 0,
            maxRetries: 1,
          };

          this.testQueue.push(loginTestItem);
        }

      } catch (error) {
        logger.error(`Failed to queue tests for application ${applicationId}: ${error}`);
      }
    }

    // Sort queue by priority
    this.testQueue.sort((a, b) => b.priority - a.priority);

    logger.info(`Queued ${this.testQueue.filter(t => t.testRunId === testRunId).length} tests for test run ${testRunId}`);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.testQueue.length > 0 && this.runningTests.size < this.maxConcurrency) {
        const testItem = this.testQueue.shift();
        if (!testItem) break;

        // Check if test run is still active
        const testRun = await prisma.testRun.findUnique({
          where: { id: testItem.testRunId },
        });

        if (!testRun || testRun.status === TestRunStatus.cancelled) {
          logger.debug(`Skipping test for cancelled test run: ${testItem.testRunId}`);
          continue;
        }

        // Start test execution
        await this.executeTest(testItem);
      }
    } catch (error) {
      logger.error(`Error processing test queue: ${error}`);
    } finally {
      this.isProcessing = false;
    }

    // Schedule next processing cycle if there are queued tests
    if (this.testQueue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  private async executeTest(testItem: TestQueueItem): Promise<void> {
    const executionId = `${testItem.testRunId}_${testItem.applicationId}_${testItem.testType}`;

    logger.info(`Starting test execution: ${executionId}`);

    // Create execution context
    const context: TestExecutionContext = {
      testRunId: testItem.testRunId,
      applicationId: testItem.applicationId,
      testType: testItem.testType,
      config: testItem.config,
      executionId,
      startedAt: new Date(),
      environment: {
        userAgent: 'AppSentry-HealthChecker/1.0',
        viewport: { width: 1920, height: 1080 },
        browserVersion: 'latest',
      },
    };

    // Start test execution
    const testPromise = this.runTest(context);
    this.runningTests.set(executionId, testPromise);

    // Handle test completion
    testPromise
      .then(async (result) => {
        await this.handleTestResult(result, testItem);
      })
      .catch(async (error) => {
        logger.error(`Test execution failed: ${executionId} - ${error}`);
        await this.handleTestError(error, testItem, context);
      })
      .finally(() => {
        this.runningTests.delete(executionId);
        this.processQueue(); // Continue processing queue
      });

    // Emit test started event
    this.emit('testStarted', { 
      testRunId: testItem.testRunId,
      applicationId: testItem.applicationId,
      testType: testItem.testType,
    });
  }

  private async runTest(context: TestExecutionContext): Promise<TestResultData> {
    switch (context.testType) {
      case TestType.health_check:
        const healthRunner = new HealthCheckRunner(context);
        return await healthRunner.execute();

      case TestType.login_test:
        const loginRunner = new LoginTestRunner(context);
        return await loginRunner.execute();

      default:
        throw new Error(`Unsupported test type: ${context.testType}`);
    }
  }

  private async handleTestResult(result: TestResultData, testItem: TestQueueItem): Promise<void> {
    try {
      // Store test result in database
      await prisma.testResult.create({
        data: {
          testRunId: result.testRunId,
          applicationId: result.applicationId,
          testType: result.testType,
          status: result.status,
          durationMs: result.durationMs,
          responseData: result.healthCheckData || result.loginTestData || {},
          errorMessage: result.error?.message,
          errorStack: result.error?.stack,
          screenshotUrl: result.screenshots.length > 0 ? result.screenshots[0] : null,
          healthCheckData: result.healthCheckData,
          loginTestData: result.loginTestData,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
      });

      // Update test run progress
      await this.updateTestRunProgress(result.testRunId);

      // Emit test completed event
      this.emit('testCompleted', {
        testRunId: result.testRunId,
        applicationId: result.applicationId,
        testType: result.testType,
        status: result.status,
        duration: result.durationMs,
      });

      logger.info(`Test completed: ${result.testRunId}_${result.applicationId}_${result.testType} - ${result.status}`);

    } catch (error) {
      logger.error(`Failed to handle test result: ${error}`);
    }
  }

  private async handleTestError(
    error: any,
    testItem: TestQueueItem,
    context: TestExecutionContext,
  ): Promise<void> {
    try {
      // Store failed test result
      await prisma.testResult.create({
        data: {
          testRunId: testItem.testRunId,
          applicationId: testItem.applicationId,
          testType: testItem.testType,
          status: TestStatus.failed,
          errorMessage: error.message,
          errorStack: error.stack,
          startedAt: context.startedAt,
          completedAt: new Date(),
        },
      });

      // Check if we should retry
      if (testItem.retryCount < testItem.maxRetries) {
        logger.info(`Retrying test: ${testItem.id} (attempt ${testItem.retryCount + 1}/${testItem.maxRetries})`);
        
        testItem.retryCount++;
        testItem.scheduledAt = new Date(Date.now() + 5000); // Retry after 5 seconds
        this.testQueue.unshift(testItem); // Add to front of queue
      }

      // Update test run progress
      await this.updateTestRunProgress(testItem.testRunId);

      // Emit test failed event
      this.emit('testFailed', {
        testRunId: testItem.testRunId,
        applicationId: testItem.applicationId,
        testType: testItem.testType,
        error: error.message,
      });

    } catch (dbError) {
      logger.error(`Failed to handle test error: ${dbError}`);
    }
  }

  private async updateTestRunProgress(testRunId: string): Promise<void> {
    try {
      const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: {
          testResults: true,
        },
      });

      if (!testRun) return;

      const completedCount = testRun.testResults.length;
      const queuedCount = this.testQueue.filter(t => t.testRunId === testRunId).length;
      const runningCount = Array.from(this.runningTests.keys())
        .filter(key => key.startsWith(testRunId)).length;

      const isComplete = completedCount >= testRun.progressTotal;
      const status = isComplete ? TestRunStatus.completed : TestRunStatus.running;

      await prisma.testRun.update({
        where: { id: testRunId },
        data: {
          status,
          progressCompleted: completedCount,
          completedAt: isComplete ? new Date() : null,
        },
      });

      // Emit progress update
      this.emit('progressUpdate', {
        testRunId,
        completed: completedCount,
        total: testRun.progressTotal,
        running: runningCount,
        queued: queuedCount,
        status,
      });

      if (isComplete) {
        this.emit('testRunCompleted', { testRunId, status });
        logger.info(`Test run completed: ${testRunId}`);
      }

    } catch (error) {
      logger.error(`Failed to update test run progress: ${error}`);
    }
  }

  private buildApplicationTestConfig(application: Application): ApplicationTestConfig {
    // Convert Prisma application model to test config
    // This would typically involve parsing the JSON config field
    const config = application.config as any;

    return {
      applicationId: application.id,
      name: application.name,
      displayName: application.displayName,
      healthCheck: {
        url: application.healthUrl,
        method: config.healthCheck?.method || 'GET',
        headers: config.healthCheck?.headers || {},
        expectedStatus: config.healthCheck?.expectedStatus || [200],
        expectedResponse: config.healthCheck?.expectedResponse,
        timeout: config.healthCheck?.timeout || 5000,
        followRedirects: config.healthCheck?.followRedirects !== false,
        validateSSL: config.healthCheck?.validateSSL !== false,
      },
      loginTest: {
        enabled: config.loginTest?.enabled || false,
        url: application.loginUrl || application.healthUrl,
        credentials: {
          username: config.loginTest?.credentials?.username || 'healthcheck@company.com',
          passwordEnvVar: config.loginTest?.credentials?.passwordEnvVar || 'HEALTH_CHECK_PASSWORD',
        },
        steps: config.loginTest?.steps || [],
        successCriteria: config.loginTest?.successCriteria || {},
        timeout: config.loginTest?.timeout || 30000,
        screenshotOnFailure: config.loginTest?.screenshotOnFailure !== false,
        screenshotOnSuccess: config.loginTest?.screenshotOnSuccess || false,
        cleanupSteps: config.loginTest?.cleanupSteps || [],
      },
      notifications: {
        onFailure: true,
        onSuccess: false,
        recipients: [application.ownerEmail].filter(Boolean),
      },
      metadata: {
        tags: (application.tags as string[]) || [],
        priority: 'medium',
        owner: application.ownerEmail || 'unknown',
      },
    };
  }

  private getPriority(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private removeTestsFromQueue(testRunId: string): void {
    const initialLength = this.testQueue.length;
    const filteredQueue = this.testQueue.filter(item => item.testRunId !== testRunId);
    
    this.testQueue.length = 0;
    this.testQueue.push(...filteredQueue);

    const removedCount = initialLength - this.testQueue.length;
    if (removedCount > 0) {
      logger.info(`Removed ${removedCount} tests from queue for test run ${testRunId}`);
    }
  }

  private calculateEstimatedCompletion(testRun: TestRun): Date | undefined {
    if (testRun.status === TestRunStatus.completed || testRun.status === TestRunStatus.cancelled) {
      return testRun.completedAt || undefined;
    }

    // Simple estimation based on average test duration
    const avgTestDuration = 15000; // 15 seconds average
    const remainingTests = testRun.progressTotal - testRun.progressCompleted;
    const estimatedMs = (remainingTests / this.maxConcurrency) * avgTestDuration;

    return new Date(Date.now() + estimatedMs);
  }
}

export default TestOrchestrator;