# AppSentry

A comprehensive observability platform for monitoring distributed applications with OpenTelemetry integration. Built to provide real-time insights into application performance, traces, metrics, and logs.

## Features

- **Real-time Observability** - Monitor traces, metrics, and logs from distributed applications
- **OpenTelemetry Integration** - Built-in OTLP endpoints for seamless telemetry collection
- **Modern Dashboard** - Glassmorphism UI design with responsive grid layouts
- **ClickHouse Backend** - High-performance time-series data storage optimized for observability
- **Kubernetes Ready** - Deployable on Minikube or production Kubernetes clusters
- **Service Discovery** - Automatic service name detection and cleanup
- **Real-time Data** - Live telemetry data streaming and visualization

## Technology Stack

- **Backend**: Node.js 22+, Express.js with TypeScript
- **Frontend**: React with TypeScript, CSS Grid, Glassmorphism design
- **Database**: ClickHouse for time-series telemetry data
- **Telemetry**: OpenTelemetry SDK v1.x with OTLP exporters
- **Container**: Docker, Kubernetes with OTEL Collector
- **Instrumentation**: HTTP, Express auto-instrumentation

## Project Structure

```
src/
├── routes/          # API routes including OTLP endpoints
├── services/        # ClickHouse service and telemetry processing
├── utils/           # Logging and utility functions
├── otel.ts          # OpenTelemetry initialization and configuration
└── app.ts           # Express application setup

frontend/
├── src/
│   ├── components/  # React components with glassmorphism design
│   ├── services/    # API client for telemetry data
│   └── pages/       # Dashboard pages (Overview, Traces, Metrics, Logs)

k8s/
├── clickhouse/      # ClickHouse Kubernetes manifests
└── otel/           # OpenTelemetry Collector configuration
```

## Prerequisites

- Node.js v22.14.0 or higher
- Minikube or Kubernetes cluster
- ClickHouse database
- npm or yarn

## Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/AppSentry.git
cd AppSentry
```

2. **Install dependencies:**
```bash
npm install
cd frontend && npm install && cd ..
```

3. **Set up ClickHouse on Kubernetes:**
```bash
# Start Minikube
minikube start

# Deploy ClickHouse
kubectl apply -f k8s/clickhouse/

# Port forward ClickHouse
kubectl port-forward svc/clickhouse 8123:8123 9000:9000 &
```

4. **Deploy OTEL Collector:**
```bash
kubectl apply -f k8s/otel/
```

5. **Start the backend:**
```bash
npm run dev
```

6. **Start the frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ClickHouse: http://localhost:8123

## Environment Variables

Key configuration variables in `.env`:

```bash
# Application
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=otel

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3001/api/otel
OTEL_SERVICE_NAME=AppSentry Backend
OTEL_SERVICE_VERSION=1.0.0
```

## OpenTelemetry Integration

AppSentry automatically instruments your application and collects telemetry data through OTLP endpoints:

### Built-in Endpoints
- **Traces**: `POST /api/otel/v1/traces` - Distributed tracing data
- **Metrics**: `POST /api/otel/v1/metrics` - Application metrics and counters  
- **Logs**: `POST /api/otel/v1/logs` - Structured application logs

### Query Endpoints
- **GET** `/api/otel/traces` - Retrieve traces with filtering
- **GET** `/api/otel/metrics` - Retrieve metrics data
- **GET** `/api/otel/logs` - Retrieve logs with search capabilities

### Instrumentation
The application automatically instruments:
- HTTP/HTTPS requests and responses
- Express.js middleware and routes
- Database queries (when configured)
- Custom application metrics

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint (if configured)
- `npm run typecheck` - Run TypeScript type checking

## Data Storage

AppSentry uses ClickHouse for high-performance time-series data storage:

### ClickHouse Schema
- **otel.traces** - Distributed tracing spans with timing and metadata
- **otel.metrics_sum** - Counter and sum metric data points
- **otel.metrics_gauge** - Gauge metric data points  
- **otel.logs** - Structured log records with severity levels

### Data Retention
- Traces: 7 days (configurable)
- Metrics: 30 days (configurable)
- Logs: 7 days (configurable)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Express Backend │    │   ClickHouse    │
│   (Port 3000)   │◄──►│   (Port 3001)    │◄──►│   (Port 8123)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ OTEL Collector   │
                       │ (Kubernetes)     │
                       └──────────────────┘
```

## Development Status

✅ **Completed Features:**
- OpenTelemetry SDK integration with trace, metric, and log exporters
- ClickHouse service with optimized schemas for OTEL data
- OTLP HTTP endpoints for traces, metrics, and logs ingestion
- React dashboard with glassmorphism design and responsive grid
- Real-time telemetry data visualization
- Service name cleanup and auto-detection
- Kubernetes deployment manifests for ClickHouse and OTEL Collector
- Query APIs for retrieving filtered telemetry data

🚧 **Current State:**
- All telemetry collection working (traces, metrics, logs)
- Frontend displaying real data from ClickHouse
- Service names properly cleaned up and displayed
- Ready for production deployment

📋 **Future Enhancements:**
- Advanced analytics and alerting
- Custom dashboards and visualization
- Performance optimization and caching
- Multi-tenant support

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details