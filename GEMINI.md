# AppSentry Development Context

## Project Overview
AppSentry is an application management platform that evolved from an observability tool to focus on application lifecycle management, health monitoring, and team organization. Built for managing 25+ applications in production environments.

## Current Architecture

### Tech Stack
- **Frontend**: React with TypeScript, Glassmorphism design
- **Backend**: Node.js, Express.js with TypeScript  
- **Database**: MySQL (primary), Redis (cache/sessions)
- **Container**: Docker, Kubernetes deployment ready
- **Development**: Minikube for local development

### Database Schema (MySQL)
- **Core Tables**: `applications`, `health_checks`, `users`, `teams`
- **Application Management**: Application registry, ownership, and health status
- **User Management**: JWT authentication with role-based access

## Project Evolution

### Original Intent
- Application health monitoring with heartbeat checks
- Login testing automation  
- Application lifecycle management

### Current Reality
- **Application Management Platform** focused on business value
- Application registry and team organization
- Health monitoring with SLA tracking
- Testing automation and deployment tracking
- Clean architecture without observability complexity

## Architecture Decisions

### Application-Centric Architecture
```
Dashboard (Mission Control)
├── Application Health (managed apps status)  
├── Platform Overview (infrastructure summary)
└── Recent Events (health checks, test results)

Manage (Applications)
├── Applications (registry, CRUD)
├── Health Checks (monitoring, SLA)
├── Teams (ownership, RBAC)
└── Analytics (usage, performance)

Platform
├── Testing (login tests, API tests)
├── Deployments (version tracking)
└── Settings (configuration)
```

### Data Sources Strategy
- **Application Health**: HTTP health checks, custom health indicators
- **Platform Health**: K8s API (node/pod status) - basic monitoring only
- **Real-time Updates**: 30-60 second refresh cycle
- **Error Handling**: Graceful degradation with cached data

### Role-Based Access Control
- **Admin**: Full platform access
- **Team Lead**: Team applications + limited platform access
- **Developer**: Own applications + read-only platform
- **Viewer**: Read-only access to specific applications

## Development Environment

### Current Setup
- **Backend**: Port 3001 (`npm run dev:backend`)
- **Frontend**: Port 3000 (`npm run dev:frontend`)
- **MySQL**: Port 3306
- **Development**: Minikube with clean application focus

### Environment Configuration
- Root `.env` file with application management configuration
- Backend focused on MySQL and JWT authentication
- Simplified validation focused on application management needs

### Project Structure
```
backend/
├── src/
│   ├── routes/ (Application management APIs)
│   ├── services/ (Application and health check services)
│   ├── config/ (Environment configuration)
│   └── database/ (MySQL with Prisma)

frontend/
├── src/
│   ├── components/ (React components for app management)
│   ├── services/ (API client for application data)
│   └── pages/ (Dashboard pages)

k8s/ (Kubernetes manifests)
├── mysql/ (MySQL deployment)
└── appsentry-*.yaml (Application deployments)
```

## Recent Accomplishments

### ✅ Completed Features
- Removed complex observability stack (ClickHouse, Kafka, OTEL)
- Simplified backend focused on application management
- Clean Docker images without observability dependencies
- MySQL-based data storage for application registry
- Simplified Kubernetes deployment manifests

### 🔧 Current State
- Backend v2.1 deployed without observability dependencies
- Ready for application management feature development
- Clean architecture focused on business value
- Simplified tech stack for faster development

## Development Phase Plan

### Phase 1: Core Application Management (Current Focus)
**Goal**: Build application registry and basic health monitoring
**Timeline**: Week 1

**Tasks**:
1. Design Application Registry schema (MySQL)
2. Implement Application CRUD operations
3. Create basic health check system
4. Build team/user management
5. Update frontend to focus on application management

### Phase 2: Advanced Features (Planned)
**Goal**: SLA tracking, testing automation, deployment tracking
**Timeline**: Week 2-3

**Tasks**:
1. SLA tracking and alerting
2. Login testing automation enhancement
3. Deployment tracking integration
4. Advanced team management features
5. Application analytics and reporting

## Technical Decisions

### State Management
- **Current**: React Context + useReducer
- **Simple**: Built-in state management for application data

### API Structure
- `/api/applications/*` - Application registry and management
- `/api/health-checks/*` - Health monitoring and SLA tracking
- `/api/teams/*` - Team and user management
- `/api/tests/*` - Testing automation
- `/api/platform/*` - Basic platform status (simplified)

### Health Check Format
```json
{
  "applicationId": "string",
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-06-27T10:30:00Z",
  "responseTime": 150,
  "details": {...}
}
```

### Database Strategy
- **Primary**: MySQL for all application data
- **Simple**: Single database, no complex time-series needs
- **Prisma**: ORM for type-safe database operations
- **Migrations**: Version-controlled schema changes

## Key Metrics & SLAs

### Application Health Targets
- **Health Check Frequency**: Every 60 seconds
- **SLA Calculation**: Real-time availability tracking
- **Response Time**: Track application response times
- **Uptime**: Business-focused availability metrics

### Platform Health Targets
- **Dashboard Load**: < 500ms for application views
- **Data Freshness**: 1-2 minute updates
- **System Availability**: 99.5% platform uptime

## Integration Points

### Kubernetes Integration (Simplified)
- **Basic Access**: Read-only pod/deployment status
- **Service Discovery**: Application-to-pod mapping
- **Health Correlation**: Link app health with K8s status

### Application Integration
- **Health Endpoints**: HTTP health check integration
- **API Testing**: Automated login and API testing
- **Deployment Hooks**: Version tracking integration
- **Team Integration**: Application ownership mapping

## Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- Focus on application management business logic
- Clean, maintainable code without observability complexity
- RESTful API design for application operations

### Testing Strategy
- **Real Applications**: Test with actual deployed applications
- **Health Scenarios**: Test various failure conditions
- **User Workflows**: Test complete application management flows
- **Performance**: Ensure fast application operations

### Error Handling
- **User-Friendly**: Clear error messages for application issues
- **Graceful Degradation**: Show last known status when services unavailable
- **Logging**: Application-focused logging and debugging
- **Recovery**: Automatic retry for transient failures

## Next Steps

### Immediate Tasks (Phase 1)
1. Design MySQL schema for applications and health checks
2. Implement Application CRUD API endpoints
3. Create health check scheduling system
4. Build team management functionality
5. Update frontend for application management focus

### Success Criteria
- **Functional**: Complete application registry with CRUD operations
- **Health Monitoring**: Basic health checks with SLA tracking
- **Team Management**: User/team assignment to applications
- **Performance**: Fast application operations and responsive UI
- **Scalability**: Ready for 25+ applications with good performance

## Resources & Documentation

### Internal APIs
- **Application Service**: `/backend/src/services/applicationService.ts`
- **Health Check Service**: `/backend/src/services/healthCheckService.ts`
- **Team Service**: `/backend/src/services/teamService.ts`
- **Frontend API Client**: `/frontend/src/services/api.ts`

### Configuration Files
- **Environment**: `/.env` (root level)
- **Backend Config**: `/backend/src/config/env.ts`
- **Database**: `/backend/prisma/schema.prisma`
- **Kubernetes**: `/k8s/` directory

### Database Schema
- **Applications**: Core application registry
- **HealthChecks**: Health monitoring results
- **Users**: User authentication and roles
- **Teams**: Team organization and application ownership

Last Updated: 2025-06-27
Current Phase: Phase 1 - Core Application Management
Status: Ready for application registry development