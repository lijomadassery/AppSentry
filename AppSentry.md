# Kubernetes Health Dashboard - Product Requirements Document

## 1. Executive Summary

### 1.1 Product Overview
The Kubernetes Health Dashboard is a comprehensive monitoring and testing platform designed for platform engineers to validate deployments across 25+ applications in a Kubernetes cluster. The system provides automated health checks, login testing, and real-time status monitoring with a modern, mobile-responsive interface.

### 1.2 Business Objectives
- **Improve deployment confidence** by providing reliable, reproducible health validation
- **Reduce manual testing overhead** through automated login and functionality tests
- **Enable mobile monitoring** for platform engineers during deployments
- **Integrate with CI/CD pipelines** for automated post-deployment validation
- **Provide instant notifications** via Teams and email for critical issues

### 1.3 Success Metrics
- 95% reduction in manual health check time
- 100% test coverage across all 25 applications
- <30 second end-to-end test execution time per application
- 99.9% dashboard uptime
- <2 minute notification delivery time

## 2. Product Scope

### 2.1 In Scope
- Automated health check API validation
- Headless browser testing for login flows
- Real-time status dashboard with mobile support
- Test execution orchestration and progress tracking
- Teams and email notification integration
- Historical test data and trend analysis
- CI/CD webhook integration
- Configuration management for test parameters

### 2.2 Out of Scope (Phase 1)
- Deep application workflow testing beyond login
- Performance benchmarking and load testing
- Alerting rule customization (basic rules only)
- Multi-cluster support
- User role management (single admin user)
- Custom test script authoring UI

## 3. User Stories & Requirements

### 3.1 Primary User: Platform Engineer

#### Epic 1: Health Monitoring
- **US-001**: As a platform engineer, I want to see the health status of all 25 applications at a glance so I can quickly identify issues
- **US-002**: As a platform engineer, I want to view detailed health metrics (response time, uptime, last test) for each application
- **US-003**: As a platform engineer, I want to filter applications by health status (healthy/warning/error) to focus on problematic services

#### Epic 2: Test Execution
- **US-004**: As a platform engineer, I want to run health checks for all applications with one click
- **US-005**: As a platform engineer, I want to see real-time progress when tests are running
- **US-006**: As a platform engineer, I want to run tests for individual applications when needed
- **US-007**: As a platform engineer, I want tests to automatically trigger after deployments via CI/CD integration

#### Epic 3: Mobile Access
- **US-008**: As a platform engineer, I want to access the dashboard from my mobile device during deployments
- **US-009**: As a platform engineer, I want to receive push notifications on my mobile device for critical failures
- **US-010**: As a platform engineer, I want the mobile interface to be optimized for quick status checks

#### Epic 4: Configuration Management
- **US-011**: As a platform engineer, I want to add new applications to monitor through a web interface
- **US-012**: As a platform engineer, I want to update application configurations (URLs, timeouts, test parameters) easily
- **US-013**: As a platform engineer, I want to enable/disable monitoring for specific applications
- **US-014**: As a platform engineer, I want to export and import application configurations for backup

#### Epic 5: Notifications & Reporting
- **US-015**: As a platform engineer, I want to receive Teams notifications when tests fail
- **US-016**: As a platform engineer, I want to receive email summaries of test runs
- **US-017**: As a platform engineer, I want to see historical test results and trends
- **US-018**: As a platform engineer, I want to view detailed logs for failed tests
- **US-019**: As a platform engineer, I want to generate weekly/monthly health reports
- **US-020**: As a platform engineer, I want to see SLA compliance reports per application
- **US-021**: As a platform engineer, I want to export test data for external analysis

#### Epic 6: Authentication & Authorization
- **US-022**: As a platform engineer, I want to authenticate using my Azure AD credentials
- **US-023**: As a platform engineer, I want role-based access (admin vs viewer permissions)
- **US-024**: As an admin, I want to manage user access and permissions
- **US-025**: As a user, I want secure session management with automatic token refresh

## 4. Technical Architecture

### 4.1 System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Backend API    │    │  Test Runner    │
│  (React/Vue)    │◄──►│ (Node.js/Express│◄──►│  (Playwright)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         │              │     Redis       │             │
         │              │ (Real-time data)│             │
         │              └─────────────────┘             │
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         └──────────────┤     MySQL       │◄────────────┘
                        │ (Historical data)│
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │  Notifications  │
                        │ Teams + Email   │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Azure AD      │
                        │ Authentication  │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │  Azure Blob     │
                        │   Storage       │
                        └─────────────────┘
```

### 4.2 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- WebSocket client for real-time updates
- PWA support for mobile

**Backend:**
- Node.js 18+ with Express
- TypeScript for type safety
- WebSocket server (Socket.io)
- Azure AD authentication with JWT
- MySQL 8.0+ with Sequelize ORM
- Passport.js for auth middleware

**Testing Engine:**
- Playwright for browser automation
- Parallel test execution
- Screenshot capture on failures
- Configurable timeouts

**Data Storage:**
- Redis for real-time status and caching
- MySQL 8.0+ for historical data and configuration
- Azure Blob Storage for screenshots and logs

**Infrastructure:**
- Kubernetes deployment
- Docker containers
- Ingress controller for routing
- Azure Active Directory integration
- Azure Blob Storage for artifacts

## 5. Detailed Feature Specifications

### 5.1 Dashboard Interface

#### 5.1.1 Header Section
- **Logo/Title**: "Platform Health Dashboard" with activity icon
- **User Info**: Azure AD user name and avatar with logout option
- **Status Overview**: Badge counters for healthy/warning/error applications
- **Actions**: "Run All Tests", "Configure Apps", "Reports", and "Settings" buttons
- **Responsive**: Stacks vertically on mobile

#### 5.1.2 Application Grid
- **Card Layout**: Each application displayed as a card with:
  - Application name with edit icon for quick config access
  - Status indicator (colored dot)
  - Health check response time
  - Last test timestamp
  - Uptime percentage
  - Configuration status (configured/needs setup)
- **Grid Responsive**: 3-4 columns on desktop, 1 column on mobile
- **Filter Bar**: Toggle buttons for All/Healthy/Warning/Error/Unconfigured
- **Hover Effects**: Cards lift on hover with shadow
- **Quick Actions**: Edit, Test Now, View Logs buttons on hover

#### 5.1.3 Application Configuration Panel
- **Add New App**: Modal form to add applications with guided setup
- **Edit Existing**: In-place editing with validation
- **Bulk Operations**: Import/export configurations via JSON/CSV
- **Test Configuration**: Preview button to test settings before saving
- **Configuration Templates**: Pre-built templates for common app types

#### 5.1.4 Sidebar Panels
- **Test Progress**: Shows current test execution status
  - Progress bar with percentage
  - Currently testing application name
  - Estimated time remaining
  - Cancel/pause test run options
- **Recent Activity**: Real-time log of test events
  - Timestamp
  - Application name
  - Status change
  - Color-coded by status
  - Click to view details

#### 5.1.5 Reports Dashboard
- **Executive Summary**: High-level health metrics and trends
- **SLA Compliance**: Per-application uptime vs targets
- **Performance Trends**: Response time trends over time
- **Failure Analysis**: Most common failure patterns
- **Scheduled Reports**: Automated weekly/monthly report generation

### 5.2 Test Execution Engine

#### 5.2.1 Health Check Tests
```javascript
// Health check configuration per app
{
  "name": "user-service",
  "healthEndpoint": "https://user-service.company.com/health",
  "expectedStatus": 200,
  "timeout": 5000,
  "expectedResponse": {
    "status": "healthy"
  }
}
```

#### 5.2.2 Login Tests
```javascript
// Login test configuration per app
{
  "name": "user-service",
  "loginUrl": "https://user-service.company.com/login",
  "credentials": {
    "username": "healthcheck@company.com",
    "password": "${HEALTH_CHECK_PASSWORD}"
  },
  "successSelectors": [
    "[data-testid='dashboard']",
    ".navigation-menu"
  ],
  "timeout": 30000,
  "screenshotOnFailure": true
}
```

#### 5.2.3 Test Orchestration
- **Parallel Execution**: Run up to 5 tests simultaneously
- **Queue Management**: Queue remaining tests when limit reached
- **Retry Logic**: Retry failed tests once with exponential backoff
- **Progress Tracking**: Real-time updates via WebSocket

### 5.3 Configuration Management

#### 5.3.1 Application Configuration Interface
```typescript
interface ApplicationConfig {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  environment: 'development' | 'staging' | 'production';
  category: string; // 'api', 'frontend', 'service', 'database'
  owner: {
    team: string;
    email: string;
    slackChannel?: string;
  };
  healthCheck: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    expectedStatus: number[];
    expectedResponse?: any;
    timeout: number;
    interval: number; // seconds between checks
    retryAttempts: number;
    enabled: boolean;
  };
  loginTest: {
    url: string;
    enabled: boolean;
    credentials: {
      username: string;
      passwordEnvVar: string; // Reference to env variable
    };
    steps: LoginTestStep[];
    successCriteria: {
      selectors: string[];
      urlPattern?: string;
      textContent?: string[];
    };
    timeout: number;
    screenshotOnFailure: boolean;
  };
  notifications: {
    teams: {
      enabled: boolean;
      webhookUrl?: string;
      channels: string[];
    };
    email: {
      enabled: boolean;
      recipients: string[];
    };
    alertThresholds: {
      consecutive_failures: number;
      response_time_ms: number;
      uptime_percentage: number;
    };
  };
  sla: {
    uptime_target: number; // percentage
    response_time_target: number; // milliseconds
    availability_window: string; // cron expression
  };
  metadata: {
    tags: string[];
    documentation_url?: string;
    repository_url?: string;
    monitoring_dashboard?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

interface LoginTestStep {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'screenshot';
  selector?: string;
  text?: string;
  url?: string;
  timeout?: number;
  description: string;
}
```

#### 5.3.2 Configuration Templates
```json
{
  "templates": {
    "react_spa": {
      "name": "React SPA Application",
      "description": "Standard React single-page application",
      "defaults": {
        "healthCheck": {
          "url": "https://{app-name}.company.com/health",
          "timeout": 5000,
          "expectedStatus": [200]
        },
        "loginTest": {
          "enabled": true,
          "steps": [
            {
              "type": "navigate",
              "url": "https://{app-name}.company.com/login",
              "description": "Navigate to login page"
            },
            {
              "type": "type",
              "selector": "input[name='email']",
              "text": "{username}",
              "description": "Enter username"
            },
            {
              "type": "type",
              "selector": "input[name='password']",
              "text": "{password}",
              "description": "Enter password"
            },
            {
              "type": "click",
              "selector": "button[type='submit']",
              "description": "Click login button"
            },
            {
              "type": "wait",
              "selector": "[data-testid='dashboard']",
              "timeout": 10000,
              "description": "Wait for dashboard to load"
            }
          ],
          "successCriteria": {
            "selectors": ["[data-testid='dashboard']", ".user-menu"]
          }
        }
      }
    },
    "api_service": {
      "name": "REST API Service",
      "description": "Backend API service",
      "defaults": {
        "healthCheck": {
          "url": "https://api.company.com/{service-name}/health",
          "timeout": 3000,
          "expectedStatus": [200],
          "expectedResponse": {"status": "healthy"}
        },
        "loginTest": {
          "enabled": false
        }
      }
    }
  }
}
```

#### 5.3.3 Configuration Management API
- **Validation Engine**: Real-time validation of configuration changes
- **Version Control**: Track configuration changes with rollback capability
- **Bulk Operations**: Import/export configurations for disaster recovery
- **Environment Promotion**: Copy configurations between environments
- **Configuration Testing**: Dry-run capability to test configs before applying

## 6. API Specifications

### 6.1 REST API Endpoints

#### 6.1.1 Authentication
```
POST   /api/auth/azure/login         # Initiate Azure AD OAuth flow
GET    /api/auth/azure/callback      # Azure AD callback handler
POST   /api/auth/refresh             # Refresh JWT token
POST   /api/auth/logout              # Logout and invalidate token
GET    /api/auth/me                  # Get current user info
```

#### 6.1.2 Application Management
```
GET    /api/applications             # Get all applications (with pagination)
POST   /api/applications             # Create new application
GET    /api/applications/:id         # Get specific application
PUT    /api/applications/:id         # Update application config
DELETE /api/applications/:id         # Delete application
POST   /api/applications/:id/test    # Run test for specific app
POST   /api/applications/bulk        # Bulk create/update applications
GET    /api/applications/templates   # Get configuration templates
POST   /api/applications/import      # Import applications from JSON/CSV
GET    /api/applications/export      # Export applications configuration
```

#### 6.1.3 Test Execution
```
POST   /api/tests/run-all            # Start full test suite
POST   /api/tests/run-apps           # Run tests for specific apps
GET    /api/tests/status             # Get current test run status
GET    /api/tests/history            # Get test history (with filters)
GET    /api/tests/:id                # Get specific test run details
GET    /api/tests/:id/logs           # Get detailed test logs
DELETE /api/tests/:id               # Cancel running test
POST   /api/tests/:id/retry          # Retry failed tests
```

#### 6.1.4 Configuration Management
```
GET    /api/config                   # Get current global configuration
PUT    /api/config                   # Update global configuration
POST   /api/config/validate          # Validate configuration
GET    /api/config/history           # Get configuration change history
POST   /api/config/rollback/:version # Rollback to previous config version
```

#### 6.1.5 Reports & Analytics
```
GET    /api/reports/summary          # Executive summary dashboard
GET    /api/reports/sla              # SLA compliance report
GET    /api/reports/trends           # Performance trends analysis
GET    /api/reports/failures         # Failure pattern analysis
POST   /api/reports/schedule         # Schedule automated reports
GET    /api/reports/scheduled        # Get scheduled reports
GET    /api/analytics/uptime/:appId  # Application uptime metrics
GET    /api/analytics/performance    # Performance metrics across apps
GET    /api/analytics/availability   # Availability trends
```

#### 6.1.6 User Management
```
GET    /api/users                    # Get all users (admin only)
GET    /api/users/:id                # Get user details
PUT    /api/users/:id/role           # Update user role (admin only)
DELETE /api/users/:id               # Deactivate user (admin only)
GET    /api/users/activity           # Get user activity logs
```

#### 6.1.7 CI/CD Integration
```
POST   /api/webhooks/deployment      # Deployment webhook trigger
POST   /api/webhooks/health-check    # External health check trigger
GET    /api/integrations/status      # Get CI/CD integration status
POST   /api/integrations/validate    # Validate webhook configuration
```

### 6.2 WebSocket Events

#### 6.2.1 Client to Server
```javascript
// Subscribe to test updates
socket.emit('subscribe', { testRunId: 'uuid' });

// Trigger test run
socket.emit('startTests', { applications: ['app1', 'app2'] });
```

#### 6.2.2 Server to Client
```javascript
// Test progress update
socket.emit('testProgress', {
  testRunId: 'uuid',
  completed: 15,
  total: 25,
  current: 'user-service',
  status: 'running'
});

// Individual test result
socket.emit('testResult', {
  application: 'user-service',
  status: 'healthy',
  duration: 1250,
  timestamp: '2025-06-20T10:30:00Z'
});

// Test run complete
socket.emit('testComplete', {
  testRunId: 'uuid',
  summary: {
    total: 25,
    passed: 23,
    failed: 2,
    duration: 45000
  }
});
```

## 7. Wireframes

### 7.1 Desktop Layout (1920x1080)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ 🔄 Platform Health    👤 John Doe [Admin] [22 Healthy] [2 Warning] [1 Error]   │
│                                              [Run Tests] [Configure] [Reports]  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│ Applications (25)   [+ Add App]              [All][Healthy][Warning][Error]   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ │user-service │ │auth-service │ │payment-api  │ │user-dash    │              │
│ │     🟢   ⚙️│ │     🟢   ⚙️│ │     🔴   ⚙️│ │     🟢   ⚙️│              │
│ │Health: 200ms│ │Health: 150ms│ │Health: timeout│ │Health: 180ms│             │
│ │Last: 2m ago │ │Last: 2m ago │ │Last: 5m ago │ │Last: 1m ago │              │
│ │Uptime: 99.9%│ │Uptime: 99.8%│ │Uptime: 98.1%│ │Uptime: 99.7%│              │
│ │SLA: ✅      │ │SLA: ✅      │ │SLA: ⚠️      │ │SLA: ✅      │              │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                                │
│ [More app cards in grid layout with hover actions: Test, Edit, Logs...]       │
│                                                                                │
├──────────────────────────────────────────────────────┬─────────────────────────┤
│                                                      │ Test Progress           │
│                                                      │ ┌─────────────────────┐ │
│                                                      │ │ ⚪ Testing payment   │ │
│                                                      │ │ ████░░░░░░ 40%      │ │
│                                                      │ │ 10 of 25 complete   │ │
│                                                      │ │ [Cancel] [Pause]    │ │
│                                                      │ └─────────────────────┘ │
│                                                      │                         │
│                                                      │ Recent Activity         │
│                                                      │ 🟢 user-service OK 2m   │
│                                                      │ 🔴 payment-api fail 5m  │
│                                                      │ 🟢 auth-service OK 12m  │
│                                                      │ 🟡 dashboard slow 18m   │
│                                                      │ [View All Activity]     │
└──────────────────────────────────────────────────────┴─────────────────────────┘
```

### 7.2 Application Configuration Modal

```
┌─────────────────────────────────────────────────────┐
│ Configure Application: user-service           [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Basic Information                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Display Name: [User Service API            ]   │ │
│ │ Environment:  [Production ▼]                   │ │
│ │ Category:     [API Service ▼]                  │ │
│ │ Owner Team:   [Platform Team              ]   │ │
│ │ Owner Email:  [platform@company.com       ]   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Health Check Configuration                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ URL: [https://user-service.company.com/health] │ │
│ │ Method: [GET ▼]  Timeout: [5000ms]             │ │
│ │ Expected Status: [200, 204]                    │ │
│ │ Interval: [300] seconds                        │ │
│ │ Retry Attempts: [3]                            │ │
│ │ ☑️ Enabled                                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Login Test Configuration                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Login URL: [https://user-service.company.com/]  │ │
│ │ Username: [healthcheck@company.com          ]  │ │
│ │ Password Env: [HEALTH_CHECK_PASSWORD        ]  │ │
│ │ Timeout: [30000ms]                             │ │
│ │ ☑️ Screenshot on Failure                       │ │
│ │ ☑️ Enabled                                     │ │
│ │ [Configure Test Steps...]                      │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Notifications & SLA                                 │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Teams: ☑️  Email: ☑️  Threshold: [Error Only▼] │ │
│ │ Uptime Target: [99.5%]  Response: [2000ms]     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│              [Test Config] [Save] [Cancel]          │
└─────────────────────────────────────────────────────┘
```

### 7.3 Reports Dashboard

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Reports & Analytics                               [Schedule Report] [Export]    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│ Executive Summary                              Last 30 Days                    │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Overall Health: 92.3% ✅    Failed Tests: 23    Avg Response: 245ms        │ │
│ │ SLA Compliance: 96.2% ⚠️    Total Tests: 2,456  Uptime: 99.1%             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────────────┐ │
│ │ SLA Compliance by App       │ │ Response Time Trends                        │ │
│ │                             │ │                                             │ │
│ │ user-service    99.9% ✅    │ │     ^                                       │ │
│ │ auth-service    99.8% ✅    │ │     │     /\                                │ │
│ │ payment-api     98.1% ⚠️    │ │ ms  │    /  \                               │ │
│ │ user-dashboard  99.7% ✅    │ │     │   /    \                              │ │
│ │ admin-panel     98.9% ⚠️    │ │     │  /      \____                         │ │
│ │ [View All...]               │ │     └─────────────────────> time            │ │
│ └─────────────────────────────┘ └─────────────────────────────────────────────┘ │
│                                                                                │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────────────────┐ │
│ │ Top Failures (Last 7 Days) │ │ Scheduled Reports                           │ │
│ │                             │ │                                             │ │
│ │ 1. payment-api timeout (12) │ │ ✅ Weekly SLA Report (Fridays)             │ │
│ │ 2. admin-panel 500 (8)      │ │ ✅ Monthly Executive Summary (1st)         │ │
│ │ 3. user-dashboard slow (5)  │ │ ⏸️ Daily Health Check (Paused)            │ │
│ │ 4. auth-service cert (3)    │ │                                             │ │
│ │ [View Details...]           │ │ [+ Add New Report]                          │ │
│ └─────────────────────────────┘ └─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Mobile Layout (375x812)

```
┌─────────────────────────────────┐
│ 🔄 Platform Health Dashboard   │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 22 Healthy | 2 Warning      │ │
│ │ 1 Error                     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │        [Run All Tests]      │ │
│ │        [Settings]           │ │
│ └─────────────────────────────┘ │
│                                 │
│ Test Progress                   │
│ ┌─────────────────────────────┐ │
│ │ ⚪ Testing user-service...  │ │
│ │ ████████░░ 80%              │ │
│ └─────────────────────────────┘ │
│                                 │
│ Applications (25)               │
│ [All] [Healthy] [Warning] [Error]│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ user-service           🟢   │ │
│ │ Health: 200ms              │ │
│ │ Last: 2m ago | Up: 99.9%   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ auth-service           🟢   │ │
│ │ Health: 150ms              │ │
│ │ Last: 2m ago | Up: 99.8%   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ payment-api            🔴   │ │
│ │ Health: timeout            │ │
│ │ Last: 5m ago | Up: 98.1%   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [More cards stacked...]         │
└─────────────────────────────────┘
```

### 7.3 Test Execution Flow

```
State 1: Ready
┌─────────────────────────────────┐
│ Test Progress                   │
│ ┌─────────────────────────────┐ │
│ │ Ready to run tests          │ │
│ │ ░░░░░░░░░░ 0%               │ │
│ │ 0 of 25 complete            │ │
│ └─────────────────────────────┘ │
│ [Run All Tests]                 │
└─────────────────────────────────┘

State 2: Running
┌─────────────────────────────────┐
│ Test Progress                   │
│ ┌─────────────────────────────┐ │
│ │ ⚪ Running tests...         │ │
│ │ ████████░░ 80%              │ │
│ │ 20 of 25 complete           │ │
│ │ Currently: user-dashboard   │ │
│ └─────────────────────────────┘ │
│ [Cancel Tests]                  │
└─────────────────────────────────┘

State 3: Complete
┌─────────────────────────────────┐
│ Test Progress                   │
│ ┌─────────────────────────────┐ │
│ │ ✅ All tests completed!     │ │
│ │ ██████████ 100%             │ │
│ │ 25 of 25 complete           │ │
│ │ Duration: 45 seconds        │ │
│ │ 23 passed, 2 failed        │ │
│ └─────────────────────────────┘ │
│ [Run Again] [View Report]       │
└─────────────────────────────────┘
```

## 8. Non-Functional Requirements

### 8.1 Performance
- **Dashboard Load Time**: <2 seconds initial load
- **Test Execution**: <30 seconds per application
- **Real-time Updates**: <500ms latency for status updates
- **Concurrent Users**: Support 10 simultaneous dashboard users
- **Database Queries**: <100ms average response time

### 8.2 Reliability
- **Uptime**: 99.9% dashboard availability
- **Test Accuracy**: 99.95% reliable test results
- **Recovery Time**: <5 minutes from service restart
- **Data Backup**: Daily automated backups with 30-day retention

### 8.3 Security & Authentication

#### 8.3.1 Azure Active Directory Integration
- **OAuth 2.0 Flow**: Standard Azure AD authentication
- **JWT Tokens**: Stateless authentication with refresh token rotation
- **Role-Based Access**: Admin, Editor, Viewer roles
- **Multi-Factor Authentication**: Inherit Azure AD MFA policies
- **Conditional Access**: Support Azure AD conditional access policies

#### 8.3.2 Authorization Matrix
```
Role: Admin
- Full application CRUD operations
- Global configuration management
- User management
- All reports and analytics
- CI/CD webhook configuration

Role: Editor  
- Application CRUD operations
- Run tests and view results
- View reports and analytics
- Update application configurations

Role: Viewer
- View application status
- View test results
- View reports (read-only)
- No configuration changes
```

#### 8.3.3 Security Controls
- **HTTPS**: All communications encrypted in transit
- **Input Validation**: Comprehensive sanitization and validation
- **Rate Limiting**: API endpoints protected against abuse
- **CSRF Protection**: Cross-site request forgery prevention
- **SQL Injection Prevention**: Parameterized queries and ORM
- **Secrets Management**: Azure Key Vault integration for sensitive data
- **Audit Logging**: Complete audit trail of all user actions

### 8.4 Scalability
- **Application Support**: Easily configurable for 50+ applications
- **Horizontal Scaling**: Kubernetes pod auto-scaling
- **Database Performance**: Optimized queries with proper indexing
- **Caching Strategy**: Redis for frequently accessed data

## 9. Deployment & Infrastructure

### 9.1 Kubernetes Manifests

#### 9.1.1 Deployment Structure
```
k8s-health-dashboard/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── deployment.yaml
├── service.yaml
├── ingress.yaml
├── redis.yaml
├── postgres.yaml
└── hpa.yaml
```

#### 9.1.2 Resource Requirements
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### 9.2 Environment Configuration

#### 9.2.1 Environment Variables
```bash
# Database
MYSQL_HOST=mysql-service
MYSQL_PORT=3306
MYSQL_DATABASE=healthdb
MYSQL_USERNAME=healthcheck
MYSQL_PASSWORD=your-secure-password
DATABASE_URL=mysql://healthcheck:password@mysql:3306/healthdb

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your-redis-password

# Azure Authentication
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_REDIRECT_URI=https://health-dashboard.company.com/api/auth/azure/callback

# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=healthdashboard
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONTAINER=screenshots

# Testing
HEALTH_CHECK_PASSWORD=secure-test-password
PLAYWRIGHT_HEADLESS=true
TEST_TIMEOUT=30000
PARALLEL_TEST_LIMIT=5

# Notifications
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
SENDGRID_API_KEY=SG.your-api-key
EMAIL_FROM=noreply@company.com
EMAIL_RECIPIENTS=platform-team@company.com

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=https://health-dashboard.company.com

# Features
ENABLE_REGISTRATION=false
ENABLE_PASSWORD_RESET=false
ENABLE_BULK_OPERATIONS=true
ENABLE_SCHEDULED_REPORTS=true
```

### 9.3 CI/CD Integration

#### 9.3.1 Webhook Endpoints
```bash
# Trigger health checks after deployment
curl -X POST https://health-dashboard.company.com/api/webhooks/deployment \
  -H "Authorization: Bearer ${CI_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment": {
      "application": "user-service",
      "version": "v1.2.3",
      "environment": "production"
    }
  }'
```

#### 9.3.2 Pipeline Integration Example
```yaml
# GitLab CI example
post-deploy:
  stage: verify
  script:
    - curl -X POST $HEALTH_DASHBOARD_URL/api/webhooks/deployment
        -H "Authorization: Bearer $HEALTH_CHECK_TOKEN"
        -d '{"application": "$CI_PROJECT_NAME", "version": "$CI_COMMIT_TAG"}'
  only:
    - main
```

## 10. Development Plan

### 10.1 Phase 1 (Weeks 1-4): Foundation & Authentication
- [ ] Backend API framework setup with TypeScript
- [ ] MySQL database schema and Sequelize models
- [ ] Azure AD authentication integration
- [ ] JWT token management with refresh tokens
- [ ] User management and role-based access control
- [ ] Basic CRUD operations for applications
- [ ] Docker containerization and local development setup

### 10.2 Phase 2 (Weeks 5-8): Testing Engine & Configuration
- [ ] Playwright integration and test automation
- [ ] Health check engine with parallel execution
- [ ] Login test automation with configurable steps
- [ ] Application configuration management UI
- [ ] Configuration templates and validation
- [ ] Screenshot capture and Azure Blob Storage integration
- [ ] WebSocket real-time updates infrastructure

### 10.3 Phase 3 (Weeks 9-12): Frontend & User Experience
- [ ] React application with TypeScript setup
- [ ] Authentication flow and protected routes
- [ ] Dashboard UI with responsive design
- [ ] Application configuration interface
- [ ] Real-time status updates and test progress
- [ ] Mobile responsive design and PWA features
- [ ] User management interface (admin only)

### 10.4 Phase 4 (Weeks 13-16): Reports & Analytics
- [ ] Reports dashboard and analytics
- [ ] SLA compliance tracking and metrics
- [ ] Scheduled report generation
- [ ] Export functionality (PDF, CSV, JSON)
- [ ] Historical data aggregation and performance optimization
- [ ] Advanced filtering and search capabilities
- [ ] Notification system (Teams/Email) integration

### 10.5 Phase 5 (Weeks 17-20): Integration & Production
- [ ] CI/CD webhook endpoints and pipeline integration
- [ ] Kubernetes deployment manifests and Helm charts
- [ ] Production environment setup with monitoring
- [ ] Load testing and performance optimization
- [ ] Security audit and penetration testing
- [ ] Documentation and team training
- [ ] Production deployment and rollout

### 10.6 Phase 6 (Weeks 21-22): Feedback & Iteration
- [ ] User feedback collection and analysis
- [ ] Performance monitoring and optimization
- [ ] Feature refinements and bug fixes
- [ ] Advanced features based on user requests
- [ ] Disaster recovery testing
- [ ] Final production hardening

## 11. Success Criteria

### 11.1 Functional Acceptance
- ✅ Successfully test all 25 applications in <2 minutes
- ✅ 100% accurate health check results
- ✅ Mobile dashboard fully functional
- ✅ Real-time notifications working
- ✅ CI/CD integration operational

### 11.2 Performance Acceptance
- ✅ Dashboard loads in <2 seconds
- ✅ Test execution completes in <30s per app
- ✅ 99.9% uptime achieved
- ✅ Support 10 concurrent users
- ✅ Real-time updates <500ms latency

### 11.3 User Acceptance
- ✅ Platform engineers can monitor from mobile
- ✅ One-click test execution works reliably
- ✅ Notifications arrive within 2 minutes
- ✅ Historical data provides useful insights
- ✅ Interface is intuitive and requires no training

## 12. Appendices

### 12.1 Sample Application Configurations
See section 5.3 for detailed JSON configuration examples.

### 12.2 API Request/Response Examples
Detailed API documentation with example requests and responses for all endpoints.

### 12.3 Database Schema (MySQL)
```sql
-- Users table (synced from Azure AD)
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY, -- Azure AD object ID
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE applications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  environment ENUM('development', 'staging', 'production') NOT NULL,
  category VARCHAR(50) NOT NULL,
  health_url VARCHAR(500) NOT NULL,
  login_url VARCHAR(500),
  config JSON NOT NULL,
  owner_team VARCHAR(100),
  owner_email VARCHAR(255),
  tags JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  last_modified_by VARCHAR(36),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (last_modified_by) REFERENCES users(id),
  INDEX idx_environment (environment),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
);

-- Test runs table
CREATE TABLE test_runs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  trigger_type ENUM('manual', 'scheduled', 'webhook', 'ci_cd') NOT NULL,
  trigger_source VARCHAR(255),
  triggered_by VARCHAR(36),
  applications JSON, -- Array of application IDs being tested
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') NOT NULL,
  progress_completed INT DEFAULT 0,
  progress_total INT DEFAULT 0,
  summary JSON,
  error_message TEXT,
  FOREIGN KEY (triggered_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at),
  INDEX idx_trigger_type (trigger_type)
);

-- Test results table
CREATE TABLE test_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  test_run_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36) NOT NULL,
  test_type ENUM('health_check', 'login_test', 'combined') NOT NULL,
  status ENUM('passed', 'failed', 'skipped', 'timeout') NOT NULL,
  duration_ms INT,
  response_data JSON,
  error_message TEXT,
  error_stack TEXT,
  screenshot_url VARCHAR(500),
  logs_url VARCHAR(500),
  health_check_data JSON,
  login_test_data JSON,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  INDEX idx_test_run (test_run_id),
  INDEX idx_application (application_id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at),
  INDEX idx_composite (application_id, started_at DESC)
);

-- Application health metrics (aggregated data for reporting)
CREATE TABLE health_metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  application_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  hour TINYINT NOT NULL, -- 0-23
  total_tests INT DEFAULT 0,
  passed_tests INT DEFAULT 0,
  failed_tests INT DEFAULT 0,
  avg_response_time_ms DECIMAL(10,2),
  max_response_time_ms INT,
  min_response_time_ms INT,
  uptime_percentage DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  UNIQUE KEY uk_app_date_hour (application_id, date, hour),
  INDEX idx_date (date),
  INDEX idx_application_date (application_id, date)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  report_type ENUM('summary', 'sla', 'trends', 'failures') NOT NULL,
  schedule_cron VARCHAR(100) NOT NULL,
  recipients JSON NOT NULL,
  filters JSON,
  is_active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP NULL,
  next_run TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_next_run (next_run),
  INDEX idx_active (is_active)
);

-- Audit log
CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(36),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Configuration history
CREATE TABLE config_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  config_type ENUM('application', 'global') NOT NULL,
  resource_id VARCHAR(36), -- application ID for app configs, NULL for global
  config_data JSON NOT NULL,
  changed_by VARCHAR(36) NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_resource (config_type, resource_id),
  INDEX idx_created_at (created_at)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  application_id VARCHAR(36),
  notification_type ENUM('email', 'teams', 'sms') NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  threshold ENUM('all', 'warnings_and_errors', 'errors_only') DEFAULT 'errors_only',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_app_type (user_id, application_id, notification_type)
);
```

### 12.4 Error Handling Strategy
- Graceful degradation for non-critical failures
- Retry logic with exponential backoff
- Comprehensive logging with correlation IDs
- User-friendly error messages
- Automatic recovery mechanisms

---

**Document Version**: 1.0  
**Last Updated**: June 20, 2025  
**Owner**: Platform Engineering Team  
**Stakeholders**: DevOps, SRE, Engineering Management