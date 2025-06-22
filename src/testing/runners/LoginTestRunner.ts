import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { performance } from 'perf_hooks';
import { logger } from '../../utils/logger';
import { config } from '../../config/env';
import {
  LoginTestConfig,
  LoginTestStep,
  LoginTestResult,
  LoginTestStepResult,
  TestExecutionContext,
  TestResultData,
  TestLogEntry,
  TestExecutionError,
  LoginTestStepType,
} from '../../types/testing';
import { TestStatus } from '../../types';

export class LoginTestRunner {
  private context: TestExecutionContext;
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshots: string[] = [];

  constructor(context: TestExecutionContext) {
    this.context = context;
  }

  public async execute(): Promise<TestResultData> {
    const logs: TestLogEntry[] = [];
    const startTime = performance.now();
    let loginTestResult: LoginTestResult | undefined;
    let status: TestStatus = TestStatus.passed;
    let error: { message: string; stack?: string; code?: string } | undefined;

    try {
      this.addLog(logs, 'info', `Starting login test for ${this.context.config.name}`);

      // Initialize browser
      await this.initializeBrowser(logs);

      // Execute login test
      loginTestResult = await this.performLoginTest(logs);

      // Validate success criteria
      const validationResult = await this.validateSuccessCriteria(loginTestResult, logs);

      if (!validationResult.success) {
        status = TestStatus.failed;
        error = {
          message: validationResult.error || 'Login test validation failed',
          code: 'VALIDATION_FAILED',
        };
      }

      this.addLog(logs, 'info', `Login test completed with status: ${status}`);

    } catch (err: any) {
      status = TestStatus.failed;
      error = {
        message: err.message || 'Login test execution failed',
        stack: err.stack,
        code: this.mapErrorToCode(err),
      };

      this.addLog(logs, 'error', `Login test failed: ${error.message}`, { error: err });

      // Capture failure screenshot
      if (this.context.config.loginTest.screenshotOnFailure) {
        await this.captureScreenshot('failure', logs);
      }
    } finally {
      // Cleanup
      await this.cleanup(logs);
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
      screenshots: this.screenshots,
      logs,
      metrics: {
        consoleErrors: loginTestResult?.steps.filter(s => s.status === 'failed').length || 0,
      },
      loginTestData: loginTestResult,
    };
  }

  private async initializeBrowser(logs: TestLogEntry[]): Promise<void> {
    const testConfig = this.context.config.loginTest;
    const browserType = 'chromium'; // Default to chromium for login tests

    this.addLog(logs, 'debug', `Launching ${browserType} browser`);

    const launchOptions = {
      headless: config.testing.playwrightHeadless,
      timeout: 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
      ],
    };

    // Launch browser based on type
    switch (browserType) {
      case 'firefox':
        this.browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        this.browser = await webkit.launch(launchOptions);
        break;
      default:
        this.browser = await chromium.launch(launchOptions);
    }

    // Create browser context
    this.browserContext = await this.browser.newContext({
      viewport: this.context.environment.viewport,
      userAgent: this.context.environment.userAgent,
      ignoreHTTPSErrors: true,
      recordVideo: undefined, // Could enable video recording here
    });

    // Create page
    this.page = await this.browserContext.newPage();

    // Set up console and error logging
    this.page.on('console', (msg) => {
      this.addLog(logs, 'debug', `Browser console: ${msg.text()}`);
    });

    this.page.on('pageerror', (error) => {
      this.addLog(logs, 'error', `Page error: ${error.message}`);
    });

    this.addLog(logs, 'info', 'Browser initialized successfully');
  }

  private async performLoginTest(logs: TestLogEntry[]): Promise<LoginTestResult> {
    const testConfig = this.context.config.loginTest;
    const stepResults: LoginTestStepResult[] = [];
    let currentUrl = testConfig.url;

    this.addLog(logs, 'info', `Starting login test with ${testConfig.steps.length} steps`);

    for (let i = 0; i < testConfig.steps.length; i++) {
      const step = testConfig.steps[i];
      const stepStartTime = performance.now();

      this.addLog(logs, 'debug', `Executing step ${i + 1}: ${step.description}`);

      try {
        const stepResult = await this.executeStep(step, logs);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed' && !step.optional) {
          this.addLog(logs, 'error', `Required step failed: ${step.description}`);
          break;
        }

        // Update current URL after navigation steps
        if (step.type === 'navigate' || step.type === 'waitForNavigation') {
          currentUrl = this.page?.url() || currentUrl;
        }

      } catch (err: any) {
        const stepResult: LoginTestStepResult = {
          stepId: step.id,
          type: step.type,
          description: step.description,
          status: 'failed',
          duration: Math.round(performance.now() - stepStartTime),
          error: err.message,
          elementFound: false,
          retryCount: 0,
        };

        stepResults.push(stepResult);

        if (!step.optional) {
          this.addLog(logs, 'error', `Required step failed: ${step.description} - ${err.message}`);
          break;
        }
      }
    }

    // Extract session information
    const sessionInfo = await this.extractSessionInfo(logs);

    const result: LoginTestResult = {
      url: testConfig.url,
      steps: stepResults,
      finalUrl: this.page?.url() || currentUrl,
      successCriteriaMet: false, // Will be set by validation
      authenticationSuccess: this.evaluateAuthenticationSuccess(stepResults),
      sessionInfo,
    };

    return result;
  }

  private async executeStep(step: LoginTestStep, logs: TestLogEntry[]): Promise<LoginTestStepResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const startTime = performance.now();
    let elementFound = false;
    let retryCount = 0;
    const maxRetries = step.retry?.attempts || 0;

    const executeStepAction = async (): Promise<void> => {
      const timeout = step.timeout || this.context.config.loginTest.timeout;

      switch (step.type) {
        case 'navigate':
          if (!step.url) throw new Error('URL required for navigate step');
          await this.page!.goto(step.url, { waitUntil: 'domcontentloaded', timeout });
          break;

        case 'click':
          if (!step.selector) throw new Error('Selector required for click step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          await this.page!.click(step.selector);
          break;

        case 'type':
          if (!step.selector || !step.text) throw new Error('Selector and text required for type step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          
          // Replace credential placeholders
          let textToType = step.text;
          if (textToType === '{username}') {
            textToType = this.context.config.loginTest.credentials.username;
          } else if (textToType === '{password}') {
            textToType = process.env[this.context.config.loginTest.credentials.passwordEnvVar] || '';
          }
          
          await this.page!.fill(step.selector, textToType);
          break;

        case 'select':
          if (!step.selector || !step.text) throw new Error('Selector and value required for select step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          await this.page!.selectOption(step.selector, step.text);
          break;

        case 'check':
          if (!step.selector) throw new Error('Selector required for check step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          await this.page!.check(step.selector);
          break;

        case 'uncheck':
          if (!step.selector) throw new Error('Selector required for uncheck step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          await this.page!.uncheck(step.selector);
          break;

        case 'hover':
          if (!step.selector) throw new Error('Selector required for hover step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          await this.page!.hover(step.selector);
          break;

        case 'scroll':
          if (step.selector) {
            await this.page!.waitForSelector(step.selector, { timeout });
            elementFound = true;
            await this.page!.locator(step.selector).scrollIntoViewIfNeeded();
          } else {
            // Scroll to top or bottom based on text parameter
            const scrollY = step.text === 'bottom' ? 'document.body.scrollHeight' : '0';
            await this.page!.evaluate(`window.scrollTo(0, ${scrollY})`);
          }
          break;

        case 'wait':
          if (step.selector) {
            await this.page!.waitForSelector(step.selector, { timeout });
            elementFound = true;
          } else {
            // Simple wait
            const waitTime = parseInt(step.text || '1000', 10);
            await this.page!.waitForTimeout(waitTime);
          }
          break;

        case 'waitForNavigation':
          await this.page!.waitForLoadState('domcontentloaded', { timeout });
          break;

        case 'waitForSelector':
          if (!step.selector) throw new Error('Selector required for waitForSelector step');
          await this.page!.waitForSelector(step.selector, { timeout });
          elementFound = true;
          break;

        case 'waitForFunction':
          if (!step.condition) throw new Error('Condition required for waitForFunction step');
          await this.page!.waitForFunction(step.condition, undefined, { timeout });
          break;

        case 'screenshot':
          await this.captureScreenshot(step.description.replace(/\s+/g, '_').toLowerCase(), logs);
          break;

        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }
    };

    // Execute with retry logic
    while (retryCount <= maxRetries) {
      try {
        await executeStepAction();
        break; // Success, exit retry loop
      } catch (err: any) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw err; // Final attempt failed
        }
        
        this.addLog(logs, 'warn', `Step failed, retrying (${retryCount}/${maxRetries}): ${err.message}`);
        
        if (step.retry?.delay) {
          await this.page!.waitForTimeout(step.retry.delay);
        }
      }
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      stepId: step.id,
      type: step.type,
      description: step.description,
      status: 'passed',
      duration,
      elementFound,
      retryCount,
    };
  }

  private async validateSuccessCriteria(
    result: LoginTestResult,
    logs: TestLogEntry[],
  ): Promise<{ success: boolean; error?: string }> {
    const criteria = this.context.config.loginTest.successCriteria;
    
    this.addLog(logs, 'debug', 'Validating success criteria');

    // Check selectors
    if (criteria.selectors && criteria.selectors.length > 0) {
      for (const selector of criteria.selectors) {
        const element = await this.page?.locator(selector).first();
        const isVisible = await element?.isVisible();
        
        if (!isVisible) {
          const error = `Success criteria failed: selector "${selector}" not found or not visible`;
          this.addLog(logs, 'error', error);
          return { success: false, error };
        }
      }
    }

    // Check URL pattern
    if (criteria.urlPattern) {
      const currentUrl = this.page?.url() || result.finalUrl;
      const urlRegex = new RegExp(criteria.urlPattern);
      
      if (!urlRegex.test(currentUrl)) {
        const error = `Success criteria failed: URL "${currentUrl}" does not match pattern "${criteria.urlPattern}"`;
        this.addLog(logs, 'error', error);
        return { success: false, error };
      }
    }

    // Check text content
    if (criteria.textContent && criteria.textContent.length > 0) {
      const pageContent = await this.page?.textContent('body') || '';
      
      for (const text of criteria.textContent) {
        if (!pageContent.includes(text)) {
          const error = `Success criteria failed: text "${text}" not found on page`;
          this.addLog(logs, 'error', error);
          return { success: false, error };
        }
      }
    }

    // Custom validation function
    if (criteria.customValidation) {
      try {
        const validationResult = await this.page?.evaluate(criteria.customValidation);
        if (!validationResult) {
          const error = 'Success criteria failed: custom validation returned false';
          this.addLog(logs, 'error', error);
          return { success: false, error };
        }
      } catch (err: any) {
        const error = `Success criteria failed: custom validation error - ${err.message}`;
        this.addLog(logs, 'error', error);
        return { success: false, error };
      }
    }

    result.successCriteriaMet = true;
    this.addLog(logs, 'info', 'All success criteria met');
    return { success: true };
  }

  private async extractSessionInfo(logs: TestLogEntry[]): Promise<any> {
    if (!this.page) return undefined;

    try {
      // Extract cookies
      const cookies = await this.browserContext?.cookies() || [];

      // Extract localStorage and sessionStorage
      const storageData = await this.page.evaluate(() => {
        const localStorage: Record<string, string> = {};
        const sessionStorage: Record<string, string> = {};

        // Extract localStorage
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            localStorage[key] = window.localStorage.getItem(key) || '';
          }
        }

        // Extract sessionStorage
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            sessionStorage[key] = window.sessionStorage.getItem(key) || '';
          }
        }

        return { localStorage, sessionStorage };
      });

      return {
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          expires: cookie.expires ? new Date(cookie.expires * 1000) : undefined,
        })),
        ...storageData,
      };
    } catch (err) {
      this.addLog(logs, 'warn', 'Failed to extract session info', { error: err });
      return undefined;
    }
  }

  private evaluateAuthenticationSuccess(stepResults: LoginTestStepResult[]): boolean {
    // Consider authentication successful if all required steps passed
    const failedRequiredSteps = stepResults.filter(step => step.status === 'failed');
    return failedRequiredSteps.length === 0;
  }

  private async captureScreenshot(name: string, logs: TestLogEntry[]): Promise<void> {
    if (!this.page) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.context.applicationId}_${name}_${timestamp}.png`;
      const screenshotPath = `screenshots/${filename}`;

      // Take screenshot
      const screenshotBuffer = await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png',
      });

      this.screenshots.push(screenshotPath);
      this.addLog(logs, 'debug', `Screenshot captured: ${screenshotPath}`);

    } catch (err) {
      this.addLog(logs, 'warn', 'Failed to capture screenshot', { error: err });
    }
  }

  private async cleanup(logs: TestLogEntry[]): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browserContext) {
        await this.browserContext.close();
        this.browserContext = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.addLog(logs, 'debug', 'Browser cleanup completed');
    } catch (err) {
      this.addLog(logs, 'warn', 'Error during cleanup', { error: err });
    }
  }

  private mapErrorToCode(error: any): TestExecutionError {
    if (error.message?.includes('timeout')) return 'TIMEOUT';
    if (error.message?.includes('navigation')) return 'NAVIGATION_FAILED';
    if (error.message?.includes('selector')) return 'ELEMENT_NOT_FOUND';
    if (error.message?.includes('browser')) return 'BROWSER_CRASHED';
    if (error.message?.includes('authentication')) return 'AUTHENTICATION_FAILED';
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
    logger[level](`[LoginTest:${this.context.applicationId}] ${message}`, data);
  }
}

export default LoginTestRunner;