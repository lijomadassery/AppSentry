# Local Development Guide for Mac

## Overview
This guide explains how to set up the enterprise-grade AppSentry architecture on your Mac laptop for development, including all components from Phase 1-4.

## System Requirements

### Minimum Mac Specs
- **CPU**: M1/M2 or Intel i7 (8+ cores recommended)
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 50GB free space
- **macOS**: Big Sur or later

### Required Software
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install --cask docker
brew install minikube kubectl helm
brew install go node rust
brew install kafka clickhouse redis
brew install k9s stern  # Kubernetes debugging tools
```

## Architecture Overview for Local Dev

```
┌─────────────────────────────────────────────┐
│            Mac Development Setup             │
├─────────────────────────────────────────────┤
│  Minikube (8GB RAM, 4 CPUs)                │
│  ├── Redpanda (Kafka) - 1 node             │
│  ├── ClickHouse - 1 node                   │
│  ├── Redis - 1 node                        │
│  ├── OTEL Collector                        │
│  └── AppSentry Services                    │
├─────────────────────────────────────────────┤
│  Local Development                          │
│  ├── Go Ingestion Service (Port 8081)      │
│  ├── Node.js API (Port 3001)               │
│  ├── React Frontend (Port 3000)            │
│  └── GraphQL API (Port 4000)               │
└─────────────────────────────────────────────┘
```

## Step-by-Step Setup

### 1. Kubernetes Cluster Setup

```bash
# Start Minikube with sufficient resources
minikube start \
  --cpus=4 \
  --memory=8192 \
  --disk-size=40g \
  --driver=docker \
  --kubernetes-version=v1.28.0

# Enable necessary addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard

# Create namespaces
kubectl create namespace appsentry
kubectl create namespace appsentry-data
kubectl create namespace appsentry-monitoring
```

### 2. Data Layer Setup (Simplified for Dev)

#### Redpanda (Kafka Alternative)
```bash
# Install Redpanda operator
kubectl create namespace redpanda-system
helm repo add redpanda https://charts.redpanda.com/
helm install redpanda-operator redpanda/redpanda-operator \
  --namespace redpanda-system \
  --version 23.3.5

# Create development Redpanda cluster
cat <<EOF | kubectl apply -f -
apiVersion: cluster.redpanda.com/v1alpha1
kind: Redpanda
metadata:
  name: redpanda-dev
  namespace: appsentry-data
spec:
  image: "docker.redpanda.com/redpandadata/redpanda:v23.3.5"
  version: "v23.3.5"
  replicas: 1
  resources:
    requests:
      cpu: 1
      memory: 2Gi
    limits:
      cpu: 2
      memory: 4Gi
  configuration:
    rpcServer:
      port: 33145
    kafkaApi:
      - port: 9092
    pandaproxyApi:
      - port: 8082
    schemaRegistry:
      port: 8081
    adminApi:
      - port: 9644
  storage:
    capacity: 10Gi
    storageClassName: standard
EOF

# Wait for Redpanda to be ready
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=redpanda -n appsentry-data --timeout=300s

# Create topics
kubectl exec -it redpanda-dev-0 -n appsentry-data -- rpk topic create \
  telemetry-traces telemetry-metrics telemetry-logs \
  --brokers localhost:9092
```

#### ClickHouse (Single Node)
```bash
# Deploy ClickHouse for development
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: clickhouse-config
  namespace: appsentry-data
data:
  config.xml: |
    <clickhouse>
      <listen_host>0.0.0.0</listen_host>
      <http_port>8123</http_port>
      <tcp_port>9000</tcp_port>
      <max_concurrent_queries>100</max_concurrent_queries>
      <max_memory_usage>4294967296</max_memory_usage>
    </clickhouse>
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: clickhouse
  namespace: appsentry-data
spec:
  serviceName: clickhouse
  replicas: 1
  selector:
    matchLabels:
      app: clickhouse
  template:
    metadata:
      labels:
        app: clickhouse
    spec:
      containers:
      - name: clickhouse
        image: clickhouse/clickhouse-server:23.12
        ports:
        - containerPort: 8123
          name: http
        - containerPort: 9000
          name: native
        volumeMounts:
        - name: config
          mountPath: /etc/clickhouse-server/config.d
        - name: data
          mountPath: /var/lib/clickhouse
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
      volumes:
      - name: config
        configMap:
          name: clickhouse-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: clickhouse
  namespace: appsentry-data
spec:
  selector:
    app: clickhouse
  ports:
  - name: http
    port: 8123
  - name: native
    port: 9000
EOF

# Initialize ClickHouse schema
kubectl exec -it clickhouse-0 -n appsentry-data -- clickhouse-client --multiquery <<'EOF'
CREATE DATABASE IF NOT EXISTS otel;

CREATE TABLE IF NOT EXISTS otel.traces (
    Timestamp DateTime64(9),
    TraceId String,
    SpanId String,
    ParentSpanId String,
    ServiceName LowCardinality(String),
    SpanName String,
    Duration UInt64,
    StatusCode Enum8('UNSET' = 0, 'OK' = 1, 'ERROR' = 2),
    ResourceAttributes Map(LowCardinality(String), String),
    SpanAttributes Map(LowCardinality(String), String)
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Timestamp, TraceId);

CREATE TABLE IF NOT EXISTS otel.metrics (
    TimeUnix DateTime,
    MetricName LowCardinality(String),
    MetricType Enum8('GAUGE' = 1, 'COUNTER' = 2, 'HISTOGRAM' = 3),
    ServiceName LowCardinality(String),
    Value Float64,
    ResourceAttributes Map(LowCardinality(String), String),
    Attributes Map(LowCardinality(String), String)
) ENGINE = MergeTree()
PARTITION BY toDate(TimeUnix)
ORDER BY (ServiceName, MetricName, TimeUnix);

CREATE TABLE IF NOT EXISTS otel.logs (
    Timestamp DateTime64(9),
    TraceId String,
    SpanId String,
    SeverityText LowCardinality(String),
    SeverityNumber UInt8,
    ServiceName LowCardinality(String),
    Body String,
    ResourceAttributes Map(LowCardinality(String), String),
    LogAttributes Map(LowCardinality(String), String)
) ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Timestamp);
EOF
```

#### Redis
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install redis bitnami/redis \
  --namespace appsentry-data \
  --set auth.enabled=false \
  --set master.persistence.size=2Gi
```

### 3. Port Forwarding for Local Development

```bash
# Create a script for all port forwards
cat > ~/port-forward-appsentry.sh <<'EOF'
#!/bin/bash
echo "Starting port forwards for AppSentry development..."

# Redpanda/Kafka
kubectl port-forward -n appsentry-data svc/redpanda-dev 9092:9092 &
kubectl port-forward -n appsentry-data svc/redpanda-dev 8081:8081 &

# ClickHouse
kubectl port-forward -n appsentry-data svc/clickhouse 8123:8123 &
kubectl port-forward -n appsentry-data svc/clickhouse 9000:9000 &

# Redis
kubectl port-forward -n appsentry-data svc/redis-master 6379:6379 &

# OTEL Collector (when deployed)
kubectl port-forward -n appsentry svc/otel-collector 4317:4317 &
kubectl port-forward -n appsentry svc/otel-collector 4318:4318 &

echo "Port forwards started. Press Ctrl+C to stop all."
wait
EOF

chmod +x ~/port-forward-appsentry.sh
~/port-forward-appsentry.sh
```

### 4. Local Development Services

#### Go Ingestion Service
```bash
cd ~/Documents/Work/AppSentry/ingestion-service

# Create go.mod
go mod init github.com/appsentry/ingestion

# Install dependencies
go get github.com/segmentio/kafka-go
go get github.com/ClickHouse/clickhouse-go/v2
go get github.com/prometheus/client_golang
go get go.uber.org/zap

# Run locally
KAFKA_BROKERS=localhost:9092 \
CLICKHOUSE_HOST=localhost:9000 \
go run cmd/worker/main.go
```

#### Updated Node.js Backend
```bash
cd ~/Documents/Work/AppSentry/backend

# Update .env for local development
cat > .env.development <<EOF
NODE_ENV=development
PORT=3001

# Disable direct OTEL ingestion
OTEL_INGESTION_ENABLED=false

# Kafka configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=appsentry-backend
KAFKA_GROUP_ID=appsentry-backend-group

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=otel

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# GraphQL
GRAPHQL_PORT=4000
GRAPHQL_PLAYGROUND=true
EOF

# Install new dependencies
npm install kafkajs @apollo/server graphql-yoga dataloader

# Run backend
npm run dev:backend
```

#### GraphQL API Server
```bash
cd ~/Documents/Work/AppSentry/backend

# Create GraphQL server file
cat > src/graphql-server.ts <<'EOF'
import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { schema } from './graphql/schema';
import { createContext } from './graphql/context';

const yoga = createYoga({
  schema,
  context: createContext,
  graphiql: true,
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log('GraphQL server running on http://localhost:4000/graphql');
});
EOF

# Run GraphQL server
npx ts-node src/graphql-server.ts
```

#### React Frontend Updates
```bash
cd ~/Documents/Work/AppSentry/frontend

# Install new dependencies
npm install @apollo/client graphql @tanstack/react-query
npm install @tanstack/react-virtual @tanstack/react-table
npm install echarts echarts-for-react
npm install comlink # For Web Worker communication

# Update .env
cat > .env.development <<EOF
REACT_APP_API_URL=http://localhost:3001
REACT_APP_GRAPHQL_URL=http://localhost:4000/graphql
REACT_APP_WS_URL=ws://localhost:4000/graphql
EOF

# Run frontend
npm run dev:frontend
```

### 5. Development Workflow

#### Load Testing
```bash
# Create a load test script
cat > ~/test-load.go <<'EOF'
package main

import (
    "context"
    "fmt"
    "time"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
)

func main() {
    ctx := context.Background()
    
    exporter, _ := otlptracehttp.New(ctx,
        otlptracehttp.WithEndpoint("localhost:4318"),
        otlptracehttp.WithInsecure(),
    )
    
    // Generate 1000 traces
    for i := 0; i < 1000; i++ {
        tracer := otel.Tracer("load-test")
        _, span := tracer.Start(ctx, fmt.Sprintf("operation-%d", i))
        
        time.Sleep(10 * time.Millisecond)
        span.End()
        
        if i%100 == 0 {
            fmt.Printf("Generated %d traces\n", i)
        }
    }
}
EOF

go run ~/test-load.go
```

#### Monitoring Development Stack
```bash
# Watch Kafka topics
kubectl exec -it redpanda-dev-0 -n appsentry-data -- \
  rpk topic consume telemetry-traces --format json

# Monitor ClickHouse
kubectl exec -it clickhouse-0 -n appsentry-data -- \
  watch -n 1 "clickhouse-client -q 'SELECT count() FROM otel.traces'"

# Check ingestion service logs
kubectl logs -f deployment/telemetry-ingestion-worker -n appsentry

# Use k9s for interactive monitoring
k9s
```

### 6. Troubleshooting

#### Common Issues

1. **Minikube out of resources**
```bash
minikube stop
minikube delete
minikube start --cpus=6 --memory=12288
```

2. **Port already in use**
```bash
# Find and kill process using port
lsof -ti:9092 | xargs kill -9
```

3. **ClickHouse connection issues**
```bash
# Test connection
curl http://localhost:8123/ping
```

4. **Kafka not accepting connections**
```bash
# Check Redpanda status
kubectl get pods -n appsentry-data
kubectl logs redpanda-dev-0 -n appsentry-data
```

### 7. Development Tips

1. **Use Docker Compose for simpler setup**
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  redpanda:
    image: docker.redpanda.com/redpandadata/redpanda:v23.3.5
    ports:
      - "9092:9092"
      - "8081:8081"
    command:
      - redpanda start
      - --smp 1
      - --memory 1G
      - --overprovisioned
      - --node-id 0
      - --kafka-addr PLAINTEXT://0.0.0.0:29092,OUTSIDE://0.0.0.0:9092
      - --advertise-kafka-addr PLAINTEXT://redpanda:29092,OUTSIDE://localhost:9092
      
  clickhouse:
    image: clickhouse/clickhouse-server:23.12
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - ./clickhouse-data:/var/lib/clickhouse
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

2. **Use VS Code Dev Containers**
3. **Enable hot reloading for all services**
4. **Use ngrok for testing webhooks locally**

## Performance Targets for Local Dev

| Component | Local Target | Production Target |
|-----------|--------------|-------------------|
| Ingestion Rate | 10K/sec | 300K/sec |
| Query Latency | < 1s | < 200ms |
| Memory Usage | < 8GB | Unlimited |
| Storage | 20GB | Petabytes |

## Next Steps

1. **Start with Phase 1**: Get Kafka + Go ingestion working
2. **Test with synthetic data**: Use load generator
3. **Monitor resource usage**: Ensure Mac doesn't overheat
4. **Iterate on performance**: Profile and optimize

This setup gives you a realistic development environment that mirrors production architecture while being runnable on a Mac laptop.