# AppSentry Development Context

## Project Overview
AppSentry is a comprehensive observability platform that evolved from an application testing tool to a hybrid observability + application management platform. Built for monitoring 25+ applications in production with high-volume Kubernetes telemetry data.

## Current Architecture

### Tech Stack
- **Frontend**: React with TypeScript, Glassmorphism design
- **Backend**: Node.js, Express.js with TypeScript  
- **Databases**: ClickHouse (primary), Redis (cache/sessions), VictoriaMetrics (planned)
- **Observability**: OpenTelemetry SDK with OTLP exporters
- **Container**: Docker, Kubernetes deployment ready
- **Development**: Minikube for local development

### Database Schema (ClickHouse)
- **Existing OTEL Tables**: `otel.traces`, `otel.metrics_sum`, `otel.metrics_gauge`, `otel.logs`
- **New Application Tables**: `applications`, `health_checks` (to be added)

### Current Data Volume
- **Traces**: 188 traces with real telemetry data
- **Metrics**: 2M+ metric data points
- **Logs**: 32K+ log entries

## Project Evolution

### Original Intent
- Application health monitoring with heartbeat checks
- Login testing automation  
- Application lifecycle management

### Current Reality
- Full observability platform with OTEL integration
- Real-time traces, metrics, and logs collection
- Service discovery and health monitoring
- Mixed navigation between app-centric and platform-centric features

## Architecture Decisions

### Reorganization Strategy: Dual-Purpose Architecture
Treating both observability and app management as equal first-class features:

```
Dashboard (Mission Control)
├── Platform Health (infrastructure metrics)
├── Application Health (managed apps status)  
└── Recent Events (traces, alerts, test results)

Monitor (Observability)
├── Traces
├── Metrics
├── Logs
└── Service Map

Manage (Applications)
├── Applications
├── Health Checks
├── Analytics
└── Reports

Platform
├── Notifications
├── Teams
└── Settings
```

### Data Sources Strategy
- **Platform Health**: K8s API (node/pod metrics), OTEL collector status
- **Application Health**: HTTP health checks, K8s pod status, custom health indicators
- **Real-time Updates**: 15-30 second refresh cycle (near real-time)
- **Error Handling**: Show degraded status, fail gracefully with cached data

### Role-Based Access Control (Planned)
- **Super Admin**: Full access
- **Platform Admin**: Full platform access
- **Team Lead**: Team apps + limited platform
- **Developer**: Own apps + read-only platform
- **Viewer**: Read-only specific apps

## Development Environment

### Current Setup
- **Backend**: Port 3001 (`npm run dev:backend`)
- **Frontend**: Port 3000 (`npm run dev:frontend`)
- **ClickHouse**: Port 8123 (HTTP), 9000 (Native)
- **Development**: Minikube with ClickHouse deployed
- **OTEL Collector**: Kubernetes deployment collecting real telemetry

### Environment Configuration
- Root `.env` file with all configuration
- Backend loads environment from project root
- Simplified Joi validation focused on observability needs
- ClickHouse and OpenTelemetry configs as primary

### Project Structure
```
backend/
├── src/
│   ├── routes/ (API routes including OTLP endpoints)
│   ├── services/ (ClickHouse service and telemetry processing)
│   ├── config/ (Environment configuration)
│   └── otel.ts (OpenTelemetry initialization)

frontend/
├── src/
│   ├── components/ (React components with glassmorphism design)
│   ├── services/ (API client for telemetry data)
│   └── pages/ (Dashboard pages)

k8s/ (Kubernetes manifests)
├── clickhouse/ (ClickHouse deployment)
└── otel/ (OpenTelemetry Collector)
```

## Recent Accomplishments

### ✅ Completed Features
- OpenTelemetry SDK integration with trace, metric, and log exporters
- ClickHouse service with optimized schemas for OTEL data
- OTLP HTTP endpoints for telemetry ingestion
- React dashboard with glassmorphism design
- Real-time telemetry data visualization
- Service name cleanup and auto-detection
- Kubernetes deployment manifests
- Project structure reorganization (backend/ and frontend/ folders)
- Browser tab branding updated to "AppSentry" with custom favicon
- Environment configuration fixes for development workflow

### 🔧 Current State
- Both frontend and backend running successfully
- All telemetry collection working (traces, metrics, logs)
- ClickHouse containing real production-like data
- Ready for application management feature development

## Development Phase Plan

### Phase 1: Core Reorganization (Current Focus)
**Goal**: Reorganize UI and add basic application management
**Timeline**: Week 1

**Tasks**:
1. Add health endpoints to frontend/backend services
2. Create ClickHouse application registry tables
3. Reorganize frontend navigation structure
4. Create new Dashboard layout (mission control)
5. Move existing OTEL features to Monitor section
6. Create basic Applications management page
7. Implement application CRUD functionality
8. Add K8s API integration for platform metrics

### Phase 2: Application Health (Planned)
**Goal**: Implement health monitoring and SLA tracking
**Timeline**: Week 2

**Tasks**:
1. Implement health check scheduler
2. Create health check results storage
3. Build application status indicators
4. Add basic SLA calculations
5. Create recent events feed
6. Add demo application for testing

### Phase 3: Integration & Polish (Planned)
**Goal**: Production-ready features and optimizations
**Timeline**: Week 3

**Tasks**:
1. Enhanced K8s API integration
2. Real-time dashboard updates
3. Error handling and edge cases
4. Basic alerting/notifications
5. Performance optimizations

## Technical Decisions

### State Management
- **Phase 1**: React Context + useReducer (simple, built-in)
- **Future**: Migrate to Zustand/Redux as complexity grows

### API Structure
- `/api/otel/*` - Existing observability endpoints
- `/api/applications/*` - New application management
- `/api/platform/*` - New platform health endpoints

### Health Check Format
```json
{
  "status": "healthy|degraded|down",
  "timestamp": "2025-06-21T21:30:00Z",
  "details": {...}
}
```

### Database Strategy
- **Phase 1**: ClickHouse for everything (OTEL + applications)
- **Future**: Consider VictoriaMetrics for metrics optimization
- **Migrations**: Let Prisma handle schema changes

## Key Metrics & SLAs

### Platform Health Targets
- **Response Time**: < 200ms for dashboard loads
- **Data Freshness**: 15-30 second updates
- **Uptime**: 99.9% service availability

### Application Health Targets
- **Health Check Frequency**: Every 30 seconds
- **SLA Calculation**: Real-time availability tracking
- **Alert Response**: < 1 minute for critical issues

## Integration Points

### Kubernetes Integration
- **RBAC**: Assume pod has cluster access in Minikube
- **Metrics Source**: K8s API for node/pod metrics
- **Service Discovery**: Namespace-based team organization
- **Health Probes**: Integrate with K8s liveness/readiness probes

### OTEL Integration
- **Endpoint**: `http://localhost:3001/api/otel`
- **Service Name**: Clean service name display
- **Data Correlation**: Link health checks with traces/logs
- **Real-time Processing**: 15-30 second data freshness

## Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Component-based architecture for React
- RESTful API design for backend endpoints

### Testing Strategy
- **Real Data**: No synthetic data, use actual applications
- **Demo Apps**: Create realistic test services
- **Health Scenarios**: Test degraded states and failures
- **Performance**: Monitor query performance on large datasets

### Error Handling
- **Graceful Degradation**: Show cached data when services unavailable
- **User Feedback**: Clear error messages and degraded state indicators
- **Logging**: Comprehensive error logging for debugging
- **Recovery**: Automatic recovery when services restored

## Next Steps

### Immediate Tasks (Phase 1)
1. Create development task tracking system
2. Add health endpoints to existing services
3. Implement ClickHouse application registry tables
4. Begin frontend navigation reorganization
5. Create new Dashboard layout

### Success Criteria
- **Functional**: All existing OTEL features continue working
- **New Features**: Application registration and health monitoring working
- **User Experience**: Intuitive navigation between observability and app management
- **Performance**: Dashboard loads under 2 seconds with real data
- **Scalability**: Architecture ready for 25+ applications

## Resources & Documentation

### External Dependencies
- **ClickHouse**: Database for time-series telemetry data
- **OpenTelemetry**: Distributed tracing and metrics collection
- **Kubernetes**: Container orchestration and metrics source
- **React**: Frontend framework with TypeScript

### Internal APIs
- **ClickHouse Service**: `/backend/src/services/clickhouseService.ts`
- **OTEL Routes**: `/backend/src/routes/otel.routes.ts`
- **Frontend API Client**: `/frontend/src/services/api.ts`

### Configuration Files
- **Environment**: `/.env` (root level)
- **Backend Config**: `/backend/src/config/env.ts`
- **Docker**: `/docker-compose.yml`
- **Kubernetes**: `/k8s/` directory

Last Updated: 2025-06-21
Current Phase: Phase 1 - Core Reorganization
Status: Ready for implementation