# AppSentry Development Context

## Project Overview
AppSentry is a comprehensive observability platform that evolved from an application testing tool to a hybrid observability + application management platform. Built for monitoring 25+ applications in production with high-volume Kubernetes telemetry data.

## Current Architecture

### Tech Stack
- **Frontend**: React with TypeScript, Glassmorphism design with modern authentication UI
- **Backend**: Node.js, Express.js with TypeScript and JWT authentication
- **Authentication**: JWT-based with bcrypt password hashing, local user management
- **Databases**: ClickHouse (primary), local file storage for artifacts
- **Observability**: OpenTelemetry SDK with OTLP exporters, Kafka message queue
- **Container**: Docker multi-platform builds, Kubernetes deployment
- **Development**: Minikube with full production-like deployment
- **CI/CD**: GitHub Actions with DockerHub registry (lijomadassery namespace)

### Database Schema (ClickHouse)
- **Existing OTEL Tables**: `otel.traces`, `otel.metrics_sum`, `otel.metrics_gauge`, `otel.logs`
- **New Application Tables**: `applications`, `health_checks` (to be added)

### Current Data Volume
- **Traces**: 188 traces with real telemetry data
- **Metrics**: 2M+ metric data points
- **Logs**: 32K+ log entries

### Authentication System
- **Default Users**: admin/admin123 (admin), viewer/viewer123 (viewer), lijo/lijo2025 (admin)
- **Security**: JWT tokens with automatic refresh, bcrypt password hashing
- **UI**: Modern glassmorphism login page with responsive design
- **Session Management**: Protected routes with automatic login redirect

## Project Evolution

### Original Intent
- Application health monitoring with heartbeat checks
- Login testing automation  
- Application lifecycle management

### Current Reality
- Full observability platform with OTEL integration
- Enterprise-grade ingestion layer with Kafka buffering
- Real-time traces, metrics, and logs collection
- Complete JWT authentication system with modern UI
- Service discovery and health monitoring
- Production-ready containerized deployment

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

### Role-Based Access Control (Implemented)
- **Admin**: Full platform access (admin, lijo users)
- **Editor**: Application management + platform monitoring
- **Viewer**: Read-only access to assigned applications (viewer user)

### Ingestion Architecture
- **Phase 1**: Enterprise ingestion layer with Kafka message queue
- **Go Service**: High-performance ingestion service consuming from Kafka
- **OTEL Collector**: Configured for Kafka export with batching
- **ClickHouse**: Optimized time-series storage with real production data

## Development Environment

### Current Setup
- **Backend**: Port 3001 (`npm run dev:backend`)
- **Frontend**: Port 3000 (`npm run dev:frontend`)
- **ClickHouse**: Port 8123 (HTTP), 9000 (Native)
- **Kafka/Redpanda**: Port 9092 (Kafka protocol)
- **Ingestion Service**: Port 8080 (metrics endpoint)
- **Development**: Full Minikube deployment with production-like architecture
- **OTEL Collector**: Kubernetes deployment with Kafka export

### Environment Configuration
- Root `.env` file with all configuration
- Backend loads environment from project root
- JWT authentication configuration (required)
- ClickHouse and OpenTelemetry configs as primary
- Local file storage for artifacts (no cloud dependencies)

### Project Structure
```
backend/
├── src/
│   ├── routes/ (API routes including OTLP and auth endpoints)
│   ├── services/ (ClickHouse, auth, and telemetry processing)
│   ├── config/ (JWT and environment configuration)
│   └── otel.ts (OpenTelemetry initialization)

frontend/
├── src/
│   ├── components/ (React components with modern auth UI)
│   ├── contexts/ (Authentication and app state management)
│   ├── services/ (API client with JWT token management)
│   └── pages/ (Protected dashboard pages)

ingestion-service/ (Go-based high-performance ingestion)
├── cmd/ (Main application entry)
├── internal/ (Core business logic)
└── pkg/ (Shared packages)

k8s/ (Kubernetes manifests)
├── clickhouse/ (ClickHouse deployment)
├── otel/ (OpenTelemetry Collector with Kafka)
├── kafka/ (Redpanda/Kafka message queue)
└── appsentry-*.yaml (Application deployments)
```

## Recent Accomplishments

### ✅ Completed Features
- **Authentication System**: Complete JWT-based auth with modern UI
- **Enterprise Ingestion**: Kafka message queue with Go-based ingestion service
- **OpenTelemetry Integration**: Full OTEL SDK with trace, metric, and log exporters
- **ClickHouse Service**: Optimized schemas for high-volume OTEL data
- **React Dashboard**: Glassmorphism design with protected routes
- **Real-time Visualization**: Live telemetry data with automatic refresh
- **Container Deployment**: Docker multi-platform builds with GitHub Actions
- **Kubernetes Ready**: Production manifests with service discovery
- **CI/CD Pipeline**: Automated builds pushing to DockerHub registry
- **Security**: Bcrypt password hashing, JWT tokens, protected API endpoints

### 🔧 Current State
- Complete authentication system with modern login UI
- Enterprise ingestion layer processing real telemetry data
- Full containerized deployment ready for production
- GitHub Actions CI/CD building and pushing images
- All services running in Minikube with production-like architecture

## Development Phase Plan

### Phase 1: Enterprise Ingestion Layer (✅ COMPLETED)
**Goal**: Build production-ready ingestion architecture
**Status**: Successfully implemented and deployed

**Completed Tasks**:
1. ✅ Kafka/Redpanda message queue deployment
2. ✅ Go-based high-performance ingestion service
3. ✅ OTEL Collector with Kafka export configuration
4. ✅ Complete JWT authentication system with modern UI
5. ✅ Docker containerization and CI/CD pipeline
6. ✅ Production-ready Kubernetes manifests
7. ✅ E2E testing and validation framework
8. ✅ Real telemetry data processing and storage

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
- `/api/auth/*` - JWT authentication endpoints (login, logout, refresh)
- `/api/otel/*` - OpenTelemetry data ingestion endpoints
- `/api/telemetry/*` - Telemetry data retrieval and queries
- `/api/applications/*` - Application management and registry
- `/api/platform/*` - Platform health and Kubernetes metrics
- `/api/health-checks/*` - Application health monitoring

### Health Check Format
```json
{
  "status": "healthy|degraded|down",
  "timestamp": "2025-06-21T21:30:00Z",
  "details": {...}
}
```

### Database Strategy
- **Primary**: ClickHouse for time-series telemetry data (OTEL + applications)
- **Storage**: Local file system for artifacts and test results
- **Authentication**: In-memory user store with JWT tokens
- **Caching**: Built-in application state management
- **Future**: Consider VictoriaMetrics for metrics optimization

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
- **Ingestion**: `http://localhost:3001/api/otel` (OTLP HTTP)
- **Pipeline**: OTEL Collector → Kafka → Go Ingestion Service → ClickHouse
- **Batching**: Configurable batch sizes for optimal performance
- **Service Discovery**: Clean service name display and auto-detection
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
- **Authentication Service**: `/backend/src/services/authService.ts`
- **ClickHouse Service**: `/backend/src/services/clickhouseService.ts`
- **OTEL Routes**: `/backend/src/routes/otel.routes.ts`
- **Auth Routes**: `/backend/src/routes/auth.routes.ts`
- **Frontend API Client**: `/frontend/src/services/api.ts`
- **Auth Context**: `/frontend/src/contexts/AuthContext.tsx`

### Configuration Files
- **Environment**: `/.env` (root level)
- **Backend Config**: `/backend/src/config/env.ts`
- **Kubernetes**: `/k8s/` directory
- **CI/CD**: `/.github/workflows/build-and-push.yml`
- **Build Script**: `/build-deploy.sh`

### Deployment
- **Docker Registry**: `docker.io/lijomadassery/appsentry-*`
- **Build**: GitHub Actions with multi-platform support
- **Deploy**: Kubernetes manifests for Minikube/production
- **Test**: E2E validation script (`test-e2e-flow.sh`)

Last Updated: 2025-06-24
Current Phase: Phase 1 Complete - Enterprise Ingestion Layer ✅
Status: Production-ready authentication and ingestion system deployed