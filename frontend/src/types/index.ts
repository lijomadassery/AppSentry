export interface Application {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  environment: 'development' | 'staging' | 'production';
  category: string;
  status: 'healthy' | 'warning' | 'error';
  url: string;
  healthUrl: string;
  loginUrl?: string;
  responseTime: number;
  lastChecked: Date;
  lastTested?: Date;
  uptime: number;
  slaTarget: number;
  slaStatus: 'met' | 'warning' | 'breach';
  isActive: boolean;
  owner: {
    team: string;
    email: string;
  };
  config: any;
}

export interface TestRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  applications: string[];
  progressTotal: number;
  progressCompleted: number;
  startedAt: Date;
  completedAt?: Date;
  triggeredBy?: string;
}

export interface TestProgress {
  testRunId: string;
  currentApplication?: string;
  completed: number;
  total: number;
  status: string;
}

export interface ActivityLog {
  id: string;
  applicationId: string;
  applicationName: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  duration?: number;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface DashboardStats {
  totalApplications: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  overallHealth: number;
  averageResponseTime: number;
  totalUptime: number;
  slaCompliance: number;
}

export interface TestResult {
  id: string;
  applicationId: string;
  testType: 'health_check' | 'login_test';
  status: 'passed' | 'failed' | 'pending';
  duration: number;
  errorMessage?: string;
  timestamp: Date;
}