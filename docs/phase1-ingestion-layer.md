# Phase 1: Enterprise Ingestion Layer Implementation

## Overview
Transform AppSentry from direct ingestion to a scalable, buffered architecture capable of handling 300K+ events/second with zero data loss.

## Architecture Diagram
```
OTEL Collectors → Kafka/Redpanda → Go Workers → ClickHouse
                          ↓
                   Dead Letter Queue
```

## Week 1: Implementation Schedule

### Day 1-2: Message Queue Infrastructure

#### Redpanda Setup (Kafka Alternative - Better Performance)
```yaml
# k8s/redpanda/redpanda-cluster.yaml
apiVersion: redpanda.vectorized.io/v1alpha1
kind: Cluster
metadata:
  name: appsentry-redpanda
spec:
  image: "vectorized/redpanda"
  version: "23.3.5"
  replicas: 3
  resources:
    requests:
      cpu: 2
      memory: 4Gi
    limits:
      cpu: 4
      memory: 8Gi
  configuration:
    kafkaApi:
      - port: 9092
    schemaRegistry:
      port: 8081
    adminApi:
      - port: 9644
  storage:
    capacity: 100Gi
    storageClassName: fast-ssd
```

#### Topic Configuration
```bash
# Create topics with appropriate partitions
rpk topic create telemetry-traces -p 50 -r 3
rpk topic create telemetry-metrics -p 100 -r 3  # More partitions for higher volume
rpk topic create telemetry-logs -p 50 -r 3
rpk topic create telemetry-dlq -p 10 -r 3       # Dead letter queue
rpk topic create telemetry-aggregated -p 20 -r 3

# Set retention policies
rpk topic alter-config telemetry-traces --set retention.ms=86400000  # 24 hours
rpk topic alter-config telemetry-metrics --set retention.ms=43200000 # 12 hours
rpk topic alter-config telemetry-logs --set retention.ms=172800000   # 48 hours
```

### Day 2-3: Go Ingestion Service

#### Project Structure
```
ingestion-service/
├── cmd/
│   ├── worker/main.go
│   └── aggregator/main.go
├── internal/
│   ├── consumer/
│   │   ├── kafka.go
│   │   └── processor.go
│   ├── writer/
│   │   ├── clickhouse.go
│   │   └── batch.go
│   ├── models/
│   │   ├── trace.go
│   │   ├── metric.go
│   │   └── log.go
│   └── monitoring/
│       ├── metrics.go
│       └── health.go
├── pkg/
│   ├── config/
│   └── utils/
├── deployments/
│   └── kubernetes/
├── go.mod
└── Dockerfile
```

#### Core Ingestion Worker (Go)
```go
// cmd/worker/main.go
package main

import (
    "context"
    "os"
    "os/signal"
    "sync"
    "syscall"
    
    "github.com/appsentry/ingestion/internal/consumer"
    "github.com/appsentry/ingestion/internal/writer"
    "github.com/appsentry/ingestion/pkg/config"
    "go.uber.org/zap"
)

func main() {
    cfg := config.Load()
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // Initialize components
    kafkaConsumer := consumer.NewKafkaConsumer(cfg.Kafka, logger)
    clickhouseWriter := writer.NewClickHouseWriter(cfg.ClickHouse, logger)
    
    // Create worker pool
    workers := make([]*Worker, cfg.WorkerCount)
    for i := 0; i < cfg.WorkerCount; i++ {
        workers[i] = NewWorker(kafkaConsumer, clickhouseWriter, logger)
    }
    
    // Start workers
    ctx, cancel := context.WithCancel(context.Background())
    var wg sync.WaitGroup
    
    for _, worker := range workers {
        wg.Add(1)
        go func(w *Worker) {
            defer wg.Done()
            w.Start(ctx)
        }(worker)
    }
    
    // Wait for shutdown signal
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
    <-sigChan
    
    logger.Info("Shutting down workers...")
    cancel()
    wg.Wait()
}

// internal/consumer/processor.go
type BatchProcessor struct {
    writer      writer.ClickHouseWriter
    batchSize   int
    flushInterval time.Duration
    
    traceBatch  []models.Trace
    metricBatch []models.Metric
    logBatch    []models.Log
    
    mu sync.Mutex
}

func (bp *BatchProcessor) ProcessMessage(msg *kafka.Message) error {
    switch msg.Topic {
    case "telemetry-traces":
        return bp.processTrace(msg.Value)
    case "telemetry-metrics":
        return bp.processMetric(msg.Value)
    case "telemetry-logs":
        return bp.processLog(msg.Value)
    }
    return nil
}

func (bp *BatchProcessor) processTrace(data []byte) error {
    var trace models.Trace
    if err := json.Unmarshal(data, &trace); err != nil {
        return fmt.Errorf("unmarshal trace: %w", err)
    }
    
    bp.mu.Lock()
    bp.traceBatch = append(bp.traceBatch, trace)
    shouldFlush := len(bp.traceBatch) >= bp.batchSize
    bp.mu.Unlock()
    
    if shouldFlush {
        return bp.flushTraces()
    }
    return nil
}
```

### Day 3-4: OTEL Collector Integration

#### Updated OTEL Collector Config
```yaml
# k8s/otel/otel-collector-kafka.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config-kafka
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    
    processors:
      batch:
        timeout: 1s
        send_batch_size: 10000
        send_batch_max_size: 20000
      
      memory_limiter:
        check_interval: 1s
        limit_percentage: 80
        spike_limit_percentage: 25
      
      k8sattributes:
        extract:
          metadata:
            - k8s.pod.name
            - k8s.namespace.name
            - k8s.deployment.name
            - k8s.node.name
    
    exporters:
      kafka:
        protocol_version: 2.8.0
        brokers:
          - redpanda-0.redpanda.appsentry.svc.cluster.local:9092
          - redpanda-1.redpanda.appsentry.svc.cluster.local:9092
          - redpanda-2.redpanda.appsentry.svc.cluster.local:9092
        topic: telemetry-${data_type}  # Will create telemetry-traces, telemetry-metrics, etc
        encoding: otlp_proto
        producer:
          max_message_bytes: 1000000
          compression: snappy
          flush_max_messages: 10000
      
      # Keep debug for development
      debug:
        verbosity: basic
        sampling_initial: 10
        sampling_thereafter: 100
    
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [kafka, debug]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [kafka, debug]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [kafka, debug]
```

### Day 4-5: ClickHouse Batch Writer

#### Optimized Batch Writer
```go
// internal/writer/clickhouse.go
package writer

import (
    "context"
    "fmt"
    "time"
    
    "github.com/ClickHouse/clickhouse-go/v2"
    "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouseWriter struct {
    conn   driver.Conn
    config *Config
    
    // Metrics
    writtenTraces  prometheus.Counter
    writtenMetrics prometheus.Counter
    writtenLogs    prometheus.Counter
    writeErrors    prometheus.Counter
    writeDuration  prometheus.Histogram
}

func (w *ClickHouseWriter) WriteBatchTraces(ctx context.Context, traces []models.Trace) error {
    if len(traces) == 0 {
        return nil
    }
    
    start := time.Now()
    defer func() {
        w.writeDuration.Observe(time.Since(start).Seconds())
    }()
    
    batch, err := w.conn.PrepareBatch(ctx, `
        INSERT INTO otel.traces_buffer (
            Timestamp, TraceId, SpanId, ParentSpanId,
            ServiceName, SpanName, Duration, StatusCode,
            ResourceAttributes, SpanAttributes
        )
    `)
    if err != nil {
        w.writeErrors.Inc()
        return fmt.Errorf("prepare batch: %w", err)
    }
    
    for _, trace := range traces {
        err := batch.Append(
            trace.Timestamp,
            trace.TraceID,
            trace.SpanID,
            trace.ParentSpanID,
            trace.ServiceName,
            trace.SpanName,
            trace.Duration,
            trace.StatusCode,
            trace.ResourceAttributes,
            trace.SpanAttributes,
        )
        if err != nil {
            w.writeErrors.Inc()
            return fmt.Errorf("append trace: %w", err)
        }
    }
    
    if err := batch.Send(); err != nil {
        w.writeErrors.Inc()
        return fmt.Errorf("send batch: %w", err)
    }
    
    w.writtenTraces.Add(float64(len(traces)))
    return nil
}
```

### Day 5-6: Monitoring & Circuit Breakers

#### Health Checks and Metrics
```go
// internal/monitoring/health.go
package monitoring

type HealthChecker struct {
    kafkaHealthy      atomic.Bool
    clickhouseHealthy atomic.Bool
    lastKafkaCheck    time.Time
    lastCHCheck       time.Time
}

func (h *HealthChecker) CheckHealth() HealthStatus {
    return HealthStatus{
        Kafka: KafkaStatus{
            Healthy:        h.kafkaHealthy.Load(),
            LastCheck:      h.lastKafkaCheck,
            ConsumerLag:    h.getConsumerLag(),
            PartitionCount: h.getPartitionCount(),
        },
        ClickHouse: ClickHouseStatus{
            Healthy:         h.clickhouseHealthy.Load(),
            LastCheck:       h.lastCHCheck,
            QueuedBatches:   h.getQueuedBatches(),
            WriteRate:       h.getWriteRate(),
        },
        Ingestion: IngestionStatus{
            EventsPerSecond: h.getEventsPerSecond(),
            ErrorRate:       h.getErrorRate(),
            BackPressure:    h.getBackPressure(),
        },
    }
}
```

#### Circuit Breaker Implementation
```go
// internal/consumer/circuitbreaker.go
package consumer

type CircuitBreaker struct {
    name          string
    maxFailures   int
    resetTimeout  time.Duration
    
    failures      int
    lastFailTime  time.Time
    state         State
    mu            sync.RWMutex
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    cb.mu.RLock()
    state := cb.state
    cb.mu.RUnlock()
    
    if state == StateOpen {
        if time.Since(cb.lastFailTime) > cb.resetTimeout {
            cb.mu.Lock()
            cb.state = StateHalfOpen
            cb.failures = 0
            cb.mu.Unlock()
        } else {
            return ErrCircuitOpen
        }
    }
    
    err := fn()
    
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    if err != nil {
        cb.failures++
        cb.lastFailTime = time.Now()
        
        if cb.failures >= cb.maxFailures {
            cb.state = StateOpen
            return fmt.Errorf("circuit breaker open: %w", err)
        }
        return err
    }
    
    // Success - reset failures
    cb.failures = 0
    cb.state = StateClosed
    return nil
}
```

### Day 6-7: Load Testing & Optimization

#### Load Test Harness
```go
// test/load/generator.go
package main

import (
    "context"
    "sync"
    "time"
    
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
)

func main() {
    // Configure OTEL
    exporter, _ := otlptracehttp.New(
        context.Background(),
        otlptracehttp.WithEndpoint("localhost:4318"),
        otlptracehttp.WithInsecure(),
    )
    
    // Generate load
    targetRPS := 100000 // 100K requests per second
    workers := 100
    rpsPerWorker := targetRPS / workers
    
    var wg sync.WaitGroup
    for i := 0; i < workers; i++ {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            generateLoad(workerID, rpsPerWorker)
        }(i)
    }
    
    wg.Wait()
}

func generateLoad(workerID, rps int) {
    ticker := time.NewTicker(time.Second / time.Duration(rps))
    defer ticker.Stop()
    
    for range ticker.C {
        // Generate synthetic span
        tracer := otel.Tracer("load-test")
        _, span := tracer.Start(context.Background(), 
            fmt.Sprintf("test-operation-%d", workerID))
        
        // Add attributes
        span.SetAttributes(
            attribute.String("service.name", fmt.Sprintf("test-service-%d", workerID%10)),
            attribute.Int("worker.id", workerID),
            attribute.Float64("synthetic.value", rand.Float64()*100),
        )
        
        // Simulate work
        time.Sleep(time.Millisecond * time.Duration(rand.Intn(10)))
        span.End()
    }
}
```

## Deployment Configuration

### Kubernetes Manifests
```yaml
# k8s/ingestion/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telemetry-ingestion-worker
  namespace: appsentry
spec:
  replicas: 6  # Start with 6, scale based on load
  selector:
    matchLabels:
      app: telemetry-ingestion
  template:
    metadata:
      labels:
        app: telemetry-ingestion
    spec:
      containers:
      - name: worker
        image: appsentry/ingestion-worker:latest
        env:
        - name: KAFKA_BROKERS
          value: "redpanda-0:9092,redpanda-1:9092,redpanda-2:9092"
        - name: CLICKHOUSE_HOSTS
          value: "clickhouse-0:9000,clickhouse-1:9000,clickhouse-2:9000"
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: BATCH_SIZE
          value: "10000"
        - name: FLUSH_INTERVAL
          value: "5s"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          periodSeconds: 5
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ingestion-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: telemetry-ingestion-worker
  minReplicas: 6
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: kafka_consumer_lag
      target:
        type: AverageValue
        averageValue: "10000"  # Scale up if lag > 10K messages
```

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Ingestion Rate | 100K events/sec sustained | Kafka metrics |
| Latency (p99) | < 100ms | Prometheus histogram |
| Data Loss | 0% | DLQ monitoring |
| CPU Usage | < 70% | K8s metrics |
| Memory Usage | < 80% | K8s metrics |
| Error Rate | < 0.01% | Application metrics |

## Rollback Plan

1. Keep existing Node.js endpoints active (feature flag)
2. Dual-write to both old and new systems
3. Monitor for 24 hours before cutover
4. One-click rollback via ConfigMap change

## Cost Estimate

- Redpanda (3 nodes): ~$600/month
- Ingestion Workers (6-50 pods): ~$300-2500/month
- Additional ClickHouse capacity: ~$1000/month
- **Total Phase 1**: ~$2000-4000/month