# Phase 2: Storage Optimization & ClickHouse Scaling

## Overview
Transform ClickHouse from single-node to distributed cluster with optimized schemas, partitioning, and materialized views for handling 15-25 billion events/month.

## Goals
- Reduce storage costs by 70% through compression and tiering
- Improve query performance by 100x with materialized views
- Enable 30-90 day retention with automatic data lifecycle
- Support multi-cluster federation

## Week 2: Implementation Schedule

### Day 1-2: ClickHouse Cluster Setup

#### Distributed ClickHouse Architecture
```
┌─────────────────────┐     ┌─────────────────────┐
│   Shard 1 (2 replicas)  │     │   Shard 2 (2 replicas)  │
│  ┌─────┐  ┌─────┐  │     │  ┌─────┐  ┌─────┐  │
│  │ CH1 │  │ CH2 │  │     │  │ CH3 │  │ CH4 │  │
│  └─────┘  └─────┘  │     │  └─────┘  └─────┘  │
└─────────────────────┘     └─────────────────────┘
```

#### Cluster Configuration
```xml
<!-- /etc/clickhouse-server/config.d/cluster.xml -->
<clickhouse>
    <remote_servers>
        <appsentry_cluster>
            <shard>
                <weight>1</weight>
                <replica>
                    <host>clickhouse-shard1-replica1</host>
                    <port>9000</port>
                </replica>
                <replica>
                    <host>clickhouse-shard1-replica2</host>
                    <port>9000</port>
                </replica>
            </shard>
            <shard>
                <weight>1</weight>
                <replica>
                    <host>clickhouse-shard2-replica1</host>
                    <port>9000</port>
                </replica>
                <replica>
                    <host>clickhouse-shard2-replica2</host>
                    <port>9000</port>
                </replica>
            </shard>
        </appsentry_cluster>
    </remote_servers>
    
    <zookeeper>
        <node>
            <host>zookeeper-1</host>
            <port>2181</port>
        </node>
        <node>
            <host>zookeeper-2</host>
            <port>2181</port>
        </node>
        <node>
            <host>zookeeper-3</host>
            <port>2181</port>
        </node>
    </zookeeper>
</clickhouse>
```

### Day 2-3: Optimized Schema Design

#### Partitioned Tables with Compression
```sql
-- Drop old tables (after migration)
-- CREATE DATABASE IF NOT EXISTS otel_v2;

-- Optimized Traces Table
CREATE TABLE otel_v2.traces_local ON CLUSTER appsentry_cluster
(
    Timestamp DateTime CODEC(DoubleDelta),
    Date Date DEFAULT toDate(Timestamp),
    TraceId String CODEC(ZSTD(3)),
    SpanId String CODEC(ZSTD(3)),
    ParentSpanId String CODEC(ZSTD(3)),
    ServiceName LowCardinality(String),
    SpanName LowCardinality(String),
    SpanKind Enum8('CLIENT' = 1, 'SERVER' = 2, 'PRODUCER' = 3, 'CONSUMER' = 4, 'INTERNAL' = 5),
    Duration UInt64 CODEC(T64, ZSTD(1)),
    StatusCode Enum8('UNSET' = 0, 'OK' = 1, 'ERROR' = 2),
    StatusMessage String CODEC(ZSTD(3)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    SpanAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    -- Materialized columns for fast filtering
    HttpMethod LowCardinality(String) MATERIALIZED SpanAttributes['http.method'],
    HttpStatusCode UInt16 MATERIALIZED toUInt16OrZero(SpanAttributes['http.status_code']),
    K8sPodName LowCardinality(String) MATERIALIZED ResourceAttributes['k8s.pod.name'],
    K8sNamespace LowCardinality(String) MATERIALIZED ResourceAttributes['k8s.namespace.name']
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/traces_local', '{replica}')
PARTITION BY toYYYYMM(Date)
ORDER BY (ServiceName, toStartOfHour(Timestamp), TraceId)
TTL Date + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192,
         ttl_only_drop_parts = 1,
         merge_with_ttl_timeout = 86400;

-- Distributed Table
CREATE TABLE otel_v2.traces ON CLUSTER appsentry_cluster
AS otel_v2.traces_local
ENGINE = Distributed(appsentry_cluster, otel_v2, traces_local, cityHash64(TraceId));

-- Metrics Table (Optimized for Time Series)
CREATE TABLE otel_v2.metrics_local ON CLUSTER appsentry_cluster
(
    Timestamp DateTime CODEC(DoubleDelta),
    Date Date DEFAULT toDate(Timestamp),
    MetricName LowCardinality(String),
    ServiceName LowCardinality(String),
    Value Float64 CODEC(Gorilla, ZSTD(1)),
    MetricType Enum8('GAUGE' = 1, 'COUNTER' = 2, 'HISTOGRAM' = 3, 'SUMMARY' = 4),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    MetricAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    -- Pre-computed columns
    Environment LowCardinality(String) MATERIALIZED ResourceAttributes['deployment.environment'],
    K8sCluster LowCardinality(String) MATERIALIZED ResourceAttributes['k8s.cluster.name']
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/metrics_local', '{replica}')
PARTITION BY toYYYYMM(Date)
ORDER BY (ServiceName, MetricName, toStartOfFiveMinute(Timestamp))
TTL Date + INTERVAL 7 DAY TO VOLUME 'cold_storage',
    Date + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;

-- Logs Table (Optimized for Search)
CREATE TABLE otel_v2.logs_local ON CLUSTER appsentry_cluster
(
    Timestamp DateTime CODEC(DoubleDelta),
    Date Date DEFAULT toDate(Timestamp),
    TraceId String CODEC(ZSTD(3)),
    SpanId String CODEC(ZSTD(3)),
    SeverityNumber UInt8,
    SeverityText LowCardinality(String),
    ServiceName LowCardinality(String),
    Body String CODEC(ZSTD(3)),
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    LogAttributes Map(LowCardinality(String), String) CODEC(ZSTD(3)),
    -- Full-text search index
    INDEX body_idx Body TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/logs_local', '{replica}')
PARTITION BY toYYYYMMDD(Date)
ORDER BY (ServiceName, toStartOfTenMinutes(Timestamp), Timestamp)
TTL Date + INTERVAL 3 DAY TO VOLUME 'cold_storage',
    Date + INTERVAL 14 DAY DELETE;
```

### Day 3-4: Materialized Views for Aggregations

#### Pre-Aggregated Views
```sql
-- Service-Level Metrics (5-minute aggregates)
CREATE MATERIALIZED VIEW otel_v2.service_metrics_5min
ENGINE = ReplicatedAggregatingMergeTree('/clickhouse/tables/{shard}/service_metrics_5min', '{replica}')
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, Time5Min, ServiceName, MetricName)
TTL Date + INTERVAL 90 DAY
AS SELECT
    toDate(Timestamp) AS Date,
    toStartOfFiveMinute(Timestamp) AS Time5Min,
    ServiceName,
    MetricName,
    MetricType,
    Environment,
    K8sCluster,
    avgState(Value) AS AvgValue,
    maxState(Value) AS MaxValue,
    minState(Value) AS MinValue,
    countState() AS SampleCount,
    uniqState(ResourceAttributes['k8s.pod.name']) AS UniquePods
FROM otel_v2.metrics_local
GROUP BY Date, Time5Min, ServiceName, MetricName, MetricType, Environment, K8sCluster;

-- Error Rate Tracking
CREATE MATERIALIZED VIEW otel_v2.service_errors_hourly
ENGINE = ReplicatedSummingMergeTree('/clickhouse/tables/{shard}/service_errors_hourly', '{replica}')
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, HourTime, ServiceName, StatusCode)
AS SELECT
    toDate(Timestamp) AS Date,
    toStartOfHour(Timestamp) AS HourTime,
    ServiceName,
    StatusCode,
    HttpMethod,
    K8sNamespace,
    count() AS ErrorCount,
    avg(Duration) AS AvgDuration,
    quantile(0.95)(Duration) AS P95Duration,
    quantile(0.99)(Duration) AS P99Duration
FROM otel_v2.traces_local
WHERE StatusCode = 'ERROR'
GROUP BY Date, HourTime, ServiceName, StatusCode, HttpMethod, K8sNamespace;

-- Service Dependencies Map
CREATE MATERIALIZED VIEW otel_v2.service_dependencies
ENGINE = ReplicatedAggregatingMergeTree('/clickhouse/tables/{shard}/service_dependencies', '{replica}')
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, CallerService, CalleeService)
AS SELECT
    toDate(Timestamp) AS Date,
    ServiceName AS CallerService,
    SpanAttributes['peer.service'] AS CalleeService,
    countState() AS CallCount,
    avgState(Duration) AS AvgDuration,
    sumState(CASE WHEN StatusCode = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount
FROM otel_v2.traces_local
WHERE SpanKind = 'CLIENT' AND SpanAttributes['peer.service'] != ''
GROUP BY Date, CallerService, CalleeService;
```

### Day 4-5: Data Lifecycle Management

#### Automated Data Tiering
```sql
-- Create storage policies
CREATE STORAGE POLICY tiered_storage ON CLUSTER appsentry_cluster
VOLUMES
    hot_volume (
        DISK disk_nvme
    ),
    cold_volume (
        DISK disk_ssd
    ),
    archive_volume (
        DISK disk_s3
    );

-- Apply tiering to tables
ALTER TABLE otel_v2.traces_local ON CLUSTER appsentry_cluster
    MODIFY TTL 
        Date + INTERVAL 7 DAY TO VOLUME 'cold_volume',
        Date + INTERVAL 30 DAY TO VOLUME 'archive_volume',
        Date + INTERVAL 90 DAY DELETE;

-- Automated aggregation for old data
CREATE MATERIALIZED VIEW otel_v2.traces_daily_summary
ENGINE = ReplicatedSummingMergeTree()
PARTITION BY toYYYYMM(Date)
ORDER BY (Date, ServiceName)
AS SELECT
    toDate(Timestamp) AS Date,
    ServiceName,
    count() AS TotalSpans,
    sum(CASE WHEN StatusCode = 'ERROR' THEN 1 ELSE 0 END) AS ErrorSpans,
    avg(Duration) AS AvgDuration,
    quantile(0.50)(Duration) AS P50Duration,
    quantile(0.95)(Duration) AS P95Duration,
    quantile(0.99)(Duration) AS P99Duration,
    uniq(TraceId) AS UniqueTraces
FROM otel_v2.traces_local
WHERE Date < today() - 7
GROUP BY Date, ServiceName;
```

### Day 5-6: Query Optimization

#### Optimized Query Patterns
```sql
-- Fast service overview query
CREATE VIEW otel_v2.service_overview AS
SELECT
    ServiceName,
    toStartOfMinute(now()) AS CurrentMinute,
    avgMerge(AvgValue) AS AvgResponseTime,
    maxMerge(MaxValue) AS MaxResponseTime,
    sumMerge(SampleCount) AS TotalRequests,
    uniqMerge(UniquePods) AS ActivePods
FROM otel_v2.service_metrics_5min
WHERE Time5Min >= now() - INTERVAL 1 HOUR
GROUP BY ServiceName;

-- Efficient trace search
CREATE VIEW otel_v2.trace_search AS
WITH trace_summary AS (
    SELECT
        TraceId,
        min(Timestamp) AS StartTime,
        max(Timestamp) AS EndTime,
        count() AS SpanCount,
        any(ServiceName) AS RootService,
        max(Duration) AS TotalDuration,
        sum(CASE WHEN StatusCode = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount
    FROM otel_v2.traces
    WHERE Timestamp >= now() - INTERVAL 1 DAY
    GROUP BY TraceId
)
SELECT * FROM trace_summary;
```

### Day 6-7: Migration & Validation

#### Data Migration Strategy
```bash
#!/bin/bash
# migrate_to_v2.sh

# 1. Create new tables
clickhouse-client --multiquery < create_v2_schema.sql

# 2. Start dual writing (update ingestion service)
kubectl set env deployment/telemetry-ingestion DUAL_WRITE=true

# 3. Migrate historical data in batches
for month in {2024-01..2024-12}; do
    echo "Migrating month: $month"
    clickhouse-client --query "
        INSERT INTO otel_v2.traces
        SELECT * FROM otel.traces
        WHERE toYYYYMM(Timestamp) = '$month'
        SETTINGS max_execution_time = 3600
    "
done

# 4. Validate data consistency
clickhouse-client --query "
    SELECT 
        'v1' as version,
        count() as total_traces,
        uniq(ServiceName) as unique_services
    FROM otel.traces
    WHERE Date >= today() - 7
    UNION ALL
    SELECT 
        'v2' as version,
        count() as total_traces,
        uniq(ServiceName) as unique_services
    FROM otel_v2.traces
    WHERE Date >= today() - 7
"

# 5. Switch reads to v2
kubectl set env deployment/appsentry-backend CLICKHOUSE_VERSION=v2

# 6. Stop dual writing after validation
kubectl set env deployment/telemetry-ingestion DUAL_WRITE=false
```

## Storage Calculations

### Before Optimization
- Raw trace size: ~2KB per span
- 25B events/month = 50TB/month
- No compression = 50TB storage needed

### After Optimization
- Compressed trace: ~200 bytes per span (90% reduction)
- 25B events/month = 5TB/month
- With tiering and aggregation:
  - Hot (7 days): 1.2TB on NVMe
  - Cold (30 days): 5TB on SSD
  - Archive (90 days): 15TB on S3
  - Total cost: 80% reduction

## Performance Benchmarks

| Query Type | Before | After | Improvement |
|------------|--------|-------|-------------|
| Service Overview | 45s | 0.2s | 225x |
| Trace Search | 120s | 1.5s | 80x |
| Metrics Aggregation | 60s | 0.1s | 600x |
| Log Search | 90s | 3s | 30x |

## Monitoring Queries

```sql
-- Table sizes and compression
SELECT
    database,
    table,
    formatReadableSize(sum(bytes)) AS size,
    formatReadableSize(sum(data_uncompressed_bytes)) AS uncompressed,
    round(sum(data_compressed_bytes) / sum(data_uncompressed_bytes), 2) AS compression_ratio
FROM system.parts
WHERE database = 'otel_v2'
GROUP BY database, table;

-- Query performance
SELECT
    query_kind,
    count() AS query_count,
    round(avg(query_duration_ms)) AS avg_duration_ms,
    round(quantile(0.95)(query_duration_ms)) AS p95_duration_ms,
    round(quantile(0.99)(query_duration_ms)) AS p99_duration_ms
FROM system.query_log
WHERE query_start_time >= now() - INTERVAL 1 HOUR
    AND type = 'QueryFinish'
    AND query_kind IN ('Select', 'Insert')
GROUP BY query_kind;
```

## Rollback Plan

1. Keep v1 tables for 30 days
2. Dual write during migration
3. Feature flag for table version
4. One-click rollback via environment variable

## Success Metrics

- Storage reduction: > 70%
- Query performance: < 1s for dashboards
- Compression ratio: > 10:1
- Data freshness: < 5 minutes
- Zero data loss during migration