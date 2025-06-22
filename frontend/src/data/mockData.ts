import { Application, DashboardStats } from '../types';

export const mockApplications: Application[] = [
  {
    id: '1',
    name: 'user-service',
    displayName: 'User Service',
    description: 'User management and authentication service',
    environment: 'production',
    category: 'API Service',
    status: 'healthy',
    url: 'https://user-service.company.com',
    healthUrl: 'https://user-service.company.com/health',
    loginUrl: 'https://user-service.company.com/login',
    responseTime: 200,
    lastChecked: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    lastTested: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    uptime: 99.9,
    slaTarget: 99.5,
    slaStatus: 'met',
    isActive: true,
    owner: {
      team: 'Platform Team',
      email: 'platform@company.com',
    },
    config: {
      healthCheck: {
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        interval: 300,
        retryAttempts: 3,
        enabled: true,
      },
      loginTest: {
        enabled: true,
        credentials: {
          username: 'healthcheck@company.com',
          passwordEnvVar: 'HEALTH_CHECK_PASSWORD',
        },
        timeout: 30000,
        screenshotOnFailure: true,
      },
    },
  },
  {
    id: '2',
    name: 'auth-service',
    displayName: 'Authentication Service',
    description: 'OAuth and JWT token management',
    environment: 'production',
    category: 'API Service',
    status: 'healthy',
    url: 'https://auth-service.company.com',
    healthUrl: 'https://auth-service.company.com/health',
    responseTime: 150,
    lastChecked: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    lastTested: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    uptime: 99.8,
    slaTarget: 99.5,
    slaStatus: 'met',
    isActive: true,
    owner: {
      team: 'Security Team',
      email: 'security@company.com',
    },
    config: {
      healthCheck: {
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        interval: 300,
        retryAttempts: 3,
        enabled: true,
      },
      loginTest: {
        enabled: false,
      },
    },
  },
  {
    id: '3',
    name: 'payment-api',
    displayName: 'Payment API',
    description: 'Payment processing and billing',
    environment: 'production',
    category: 'API Service',
    status: 'error',
    url: 'https://payment-api.company.com',
    healthUrl: 'https://payment-api.company.com/health',
    responseTime: 10000, // timeout
    lastChecked: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
    lastTested: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    uptime: 98.1,
    slaTarget: 99.0,
    slaStatus: 'breach',
    isActive: true,
    owner: {
      team: 'Payment Team',
      email: 'payments@company.com',
    },
    config: {
      healthCheck: {
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        interval: 300,
        retryAttempts: 3,
        enabled: true,
      },
      loginTest: {
        enabled: true,
        credentials: {
          username: 'healthcheck@company.com',
          passwordEnvVar: 'HEALTH_CHECK_PASSWORD',
        },
        timeout: 30000,
        screenshotOnFailure: true,
      },
    },
  },
  {
    id: '4',
    name: 'user-dashboard',
    displayName: 'User Dashboard',
    description: 'Customer-facing web application',
    environment: 'production',
    category: 'Frontend',
    status: 'warning',
    url: 'https://dashboard.company.com',
    healthUrl: 'https://dashboard.company.com/health',
    loginUrl: 'https://dashboard.company.com/login',
    responseTime: 1800,
    lastChecked: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
    lastTested: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
    uptime: 99.7,
    slaTarget: 99.5,
    slaStatus: 'warning',
    isActive: true,
    owner: {
      team: 'Frontend Team',
      email: 'frontend@company.com',
    },
    config: {
      healthCheck: {
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        interval: 300,
        retryAttempts: 3,
        enabled: true,
      },
      loginTest: {
        enabled: true,
        credentials: {
          username: 'healthcheck@company.com',
          passwordEnvVar: 'HEALTH_CHECK_PASSWORD',
        },
        timeout: 30000,
        screenshotOnFailure: true,
      },
    },
  },
  {
    id: '5',
    name: 'notification-svc',
    displayName: 'Notification Service',
    description: 'Email and SMS notification service',
    environment: 'production',
    category: 'Microservice',
    status: 'healthy',
    url: 'https://notifications.company.com',
    healthUrl: 'https://notifications.company.com/health',
    responseTime: 180,
    lastChecked: new Date(Date.now() - 4 * 60 * 1000), // 4 minutes ago
    lastTested: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
    uptime: 99.6,
    slaTarget: 99.0,
    slaStatus: 'met',
    isActive: true,
    owner: {
      team: 'Platform Team',
      email: 'platform@company.com',
    },
    config: {
      healthCheck: {
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        interval: 300,
        retryAttempts: 3,
        enabled: true,
      },
      loginTest: {
        enabled: false,
      },
    },
  },
];

export const mockStats: DashboardStats = {
  totalApplications: mockApplications.length,
  healthyCount: mockApplications.filter(app => app.status === 'healthy').length,
  warningCount: mockApplications.filter(app => app.status === 'warning').length,
  errorCount: mockApplications.filter(app => app.status === 'error').length,
  overallHealth: 92.3,
  averageResponseTime: 245,
  totalUptime: 99.1,
  slaCompliance: 96.2,
};