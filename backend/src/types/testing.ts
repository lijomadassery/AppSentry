// Test types and statuses
export enum TestType {
  HEALTH_CHECK = 'HEALTH_CHECK',
  LOGIN_TEST = 'LOGIN_TEST',
  API_TEST = 'API_TEST'
}

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED'
}

// Test execution configuration
export interface TestConfig {
  timeout: number;
  retryAttempts: number;
  screenshotOnFailure: boolean;
  headless: boolean;
  browserType: 'chromium' | 'firefox' | 'webkit';
  viewportSize?: {
    width: number;
    height: number;
  };
  userAgent?: string;
}

// Health check specific configuration
export interface HealthCheckConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number[];
  expectedResponse?: any;
  timeout: number;
  followRedirects: boolean;
  validateSSL: boolean;
}

// Login test step types
export type LoginTestStepType = 
  | 'navigate' 
  | 'click' 
  | 'type' 
  | 'wait' 
  | 'screenshot' 
  | 'select'
  | 'check'
  | 'uncheck'
  | 'hover'
  | 'scroll'
  | 'waitForNavigation'
  | 'waitForSelector'
  | 'waitForFunction';

// Individual login test step
export interface LoginTestStep {
  id: string;
  type: LoginTestStepType;
  description: string;
  selector?: string;
  text?: string;
  url?: string;
  timeout?: number;
  optional?: boolean;
  condition?: string; // JavaScript condition to evaluate
  retry?: {
    attempts: number;
    delay: number;
  };
}

// Login test configuration
export interface LoginTestConfig {
  enabled: boolean;
  url: string;
  credentials: {
    username: string;
    passwordEnvVar: string;
  };
  steps: LoginTestStep[];
  successCriteria: {
    selectors?: string[];
    urlPattern?: string;
    textContent?: string[];
    customValidation?: string; // JavaScript function
  };
  timeout: number;
  screenshotOnFailure: boolean;
  screenshotOnSuccess?: boolean;
  cleanupSteps?: LoginTestStep[];
}

// Complete application test configuration
export interface ApplicationTestConfig {
  applicationId: string;
  name: string;
  displayName: string;
  healthCheck: HealthCheckConfig;
  loginTest: LoginTestConfig;
  notifications: {
    onFailure: boolean;
    onSuccess: boolean;
    recipients: string[];
  };
  metadata: {
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    owner: string;
    documentation?: string;
  };
}

// Test execution context
export interface TestExecutionContext {
  testRunId: string;
  applicationId: string;
  testType: TestType;
  config: ApplicationTestConfig;
  executionId: string;
  startedAt: Date;
  environment: {
    userAgent: string;
    viewport: { width: number; height: number };
    browserVersion: string;
  };
}

// Test result data
export interface TestResultData {
  testRunId: string;
  applicationId: string;
  testType: TestType;
  status: TestStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  screenshots: string[];
  logs: TestLogEntry[];
  metrics: {
    responseTime?: number;
    redirectCount?: number;
    resourcesLoaded?: number;
    consoleErrors?: number;
  };
  healthCheckData?: HealthCheckResult;
  loginTestData?: LoginTestResult;
}

// Health check specific result
export interface HealthCheckResult {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  headers: Record<string, string>;
  body?: any;
  redirects: string[];
  sslInfo?: {
    valid: boolean;
    issuer: string;
    expires: Date;
  };
  timing: {
    dns: number;
    connect: number;
    ssl: number;
    send: number;
    wait: number;
    receive: number;
    total: number;
  };
}

// Login test specific result
export interface LoginTestResult {
  url: string;
  steps: LoginTestStepResult[];
  finalUrl: string;
  successCriteriaMet: boolean;
  authenticationSuccess: boolean;
  sessionInfo?: {
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      expires?: Date;
    }>;
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
  };
}

// Individual step result
export interface LoginTestStepResult {
  stepId: string;
  type: LoginTestStepType;
  description: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
  elementFound: boolean;
  retryCount: number;
}

// Test log entry
export interface TestLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source: 'browser' | 'network' | 'test-runner';
}

// Test queue item
export interface TestQueueItem {
  id: string;
  testRunId: string;
  applicationId: string;
  testType: TestType;
  priority: number;
  createdAt: Date;
  scheduledAt?: Date;
  config: ApplicationTestConfig;
  retryCount: number;
  maxRetries: number;
}

// Test orchestration status
export interface TestOrchestrationStatus {
  testRunId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
  };
  startedAt: Date;
  estimatedCompletion?: Date;
  runningTests: TestExecutionContext[];
  queuedTests: TestQueueItem[];
  completedTests: TestResultData[];
}

// Browser pool configuration
export interface BrowserPoolConfig {
  maxConcurrency: number;
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  launchOptions: {
    timeout: number;
    args?: string[];
    env?: Record<string, string>;
  };
}

// Test execution error types
export type TestExecutionError = 
  | 'TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'ELEMENT_NOT_FOUND'
  | 'ASSERTION_FAILED'
  | 'NETWORK_ERROR'
  | 'BROWSER_CRASHED'
  | 'AUTHENTICATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN_ERROR';

// Test execution statistics
export interface TestExecutionStats {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  averageExecutionTime: number;
  totalExecutionTime: number;
  errorsByType: Record<TestExecutionError, number>;
  browserCrashes: number;
  networkFailures: number;
  timeoutCount: number;
}

// Artifact storage configuration
export interface ArtifactConfig {
  storageType: 'local' | 'azure-blob' | 's3';
  basePath: string;
  retention: {
    screenshots: number; // days
    logs: number; // days
    videos: number; // days
  };
  compression: boolean;
  encryption: boolean;
}