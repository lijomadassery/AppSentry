// Export all Prisma types
export type {
  User,
  Application,
  TestRun,
  TestResult,
  HealthMetric,
  ScheduledReport,
  AuditLog,
  NotificationPreference,
  ConfigHistory,
} from '@prisma/client';

// Export enums from Prisma
export {
  UserRole,
  Environment,
  TriggerType,
  TestRunStatus,
  TestType,
  TestStatus,
  ReportType,
  NotificationType,
  NotificationThreshold,
  ConfigType,
} from '@prisma/client';

// Custom types for API responses
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp?: string;
}

// User with relations
export interface UserWithRelations extends User {
  testRuns?: TestRun[];
  auditLogs?: AuditLog[];
  createdApplications?: Application[];
  modifiedApplications?: Application[];
  scheduledReports?: ScheduledReport[];
  notificationPreferences?: NotificationPreference[];
}

// Application with relations
export interface ApplicationWithRelations extends Application {
  creator?: User;
  lastModifier?: User;
  testResults?: TestResult[];
  healthMetrics?: HealthMetric[];
  notificationPreferences?: NotificationPreference[];
}

// Test run with relations
export interface TestRunWithRelations extends TestRun {
  user?: User;
  testResults?: TestResult[];
}

// Test result with relations
export interface TestResultWithRelations extends TestResult {
  testRun?: TestRun;
  application?: Application;
}

// Application creation input
export interface CreateApplicationInput {
  name: string;
  displayName: string;
  description?: string;
  environment: Environment;
  category: string;
  healthUrl: string;
  loginUrl?: string;
  config: any;
  ownerTeam?: string;
  ownerEmail?: string;
  tags?: string[];
}

// Application update input
export interface UpdateApplicationInput {
  name?: string;
  displayName?: string;
  description?: string;
  environment?: Environment;
  category?: string;
  healthUrl?: string;
  loginUrl?: string;
  config?: any;
  ownerTeam?: string;
  ownerEmail?: string;
  tags?: string[];
  isActive?: boolean;
}