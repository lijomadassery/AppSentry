-- AppSentry Application Registry Schema
-- This file creates tables for managing applications and their health checks

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS appsentry;

-- Use the appsentry database for application data
USE appsentry;

-- Applications table
-- Stores registered applications with their configuration
CREATE TABLE IF NOT EXISTS applications
(
    id String,
    name String,
    team String,
    namespace String,
    environment Enum8('development' = 1, 'staging' = 2, 'production' = 3) DEFAULT 'development',
    health_check_url String,
    health_check_interval UInt32 DEFAULT 30, -- seconds
    status Enum8('unknown' = 0, 'healthy' = 1, 'degraded' = 2, 'down' = 3) DEFAULT 'unknown',
    last_check_time DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3),
    metadata String, -- JSON string for additional data
    tags Array(String),
    sla_target Float32 DEFAULT 99.9, -- percentage
    active Bool DEFAULT true
) ENGINE = MergeTree()
ORDER BY (team, namespace, name)
PARTITION BY toYYYYMM(created_at)
TTL created_at + INTERVAL 2 YEAR;

-- Health check results table
-- Stores historical health check data
CREATE TABLE IF NOT EXISTS health_checks
(
    id String DEFAULT generateUUIDv4(),
    application_id String,
    check_time DateTime64(3, 'UTC') DEFAULT now64(3),
    status Enum8('healthy' = 1, 'degraded' = 2, 'down' = 3),
    response_time_ms UInt32,
    status_code UInt16,
    error_message String,
    details String, -- JSON string for additional check details
    check_type Enum8('http' = 1, 'tcp' = 2, 'grpc' = 3, 'custom' = 4) DEFAULT 'http'
) ENGINE = MergeTree()
ORDER BY (application_id, check_time)
PARTITION BY toYYYYMMDD(check_time)
TTL check_time + INTERVAL 30 DAY;

-- Application SLA metrics table (pre-aggregated)
-- Stores daily/hourly SLA calculations
CREATE TABLE IF NOT EXISTS application_sla_metrics
(
    application_id String,
    period_start DateTime64(3, 'UTC'),
    period_type Enum8('hour' = 1, 'day' = 2, 'week' = 3, 'month' = 4),
    total_checks UInt32,
    successful_checks UInt32,
    failed_checks UInt32,
    degraded_checks UInt32,
    availability_percentage Float32,
    avg_response_time_ms Float32,
    p95_response_time_ms Float32,
    p99_response_time_ms Float32
) ENGINE = SummingMergeTree()
ORDER BY (application_id, period_start, period_type)
PARTITION BY toYYYYMM(period_start)
TTL period_start + INTERVAL 1 YEAR;

-- Application events table
-- Stores significant events (deployments, incidents, etc.)
CREATE TABLE IF NOT EXISTS application_events
(
    id String DEFAULT generateUUIDv4(),
    application_id String,
    event_time DateTime64(3, 'UTC') DEFAULT now64(3),
    event_type Enum8('deployment' = 1, 'incident' = 2, 'maintenance' = 3, 'config_change' = 4, 'alert' = 5),
    severity Enum8('info' = 1, 'warning' = 2, 'error' = 3, 'critical' = 4) DEFAULT 'info',
    title String,
    description String,
    metadata String, -- JSON string
    created_by String
) ENGINE = MergeTree()
ORDER BY (application_id, event_time)
PARTITION BY toYYYYMM(event_time)
TTL event_time + INTERVAL 90 DAY;

-- Create materialized view for real-time application status
CREATE MATERIALIZED VIEW IF NOT EXISTS application_current_status
ENGINE = ReplacingMergeTree()
ORDER BY application_id
AS SELECT
    application_id,
    argMax(status, check_time) as current_status,
    max(check_time) as last_check_time,
    argMax(response_time_ms, check_time) as last_response_time_ms,
    countIf(status = 'healthy', check_time > now() - INTERVAL 1 HOUR) as healthy_checks_1h,
    countIf(status != 'healthy', check_time > now() - INTERVAL 1 HOUR) as unhealthy_checks_1h,
    avg(response_time_ms) as avg_response_time_1h
FROM health_checks
WHERE check_time > now() - INTERVAL 1 DAY
GROUP BY application_id;

-- Create materialized view for SLA calculation
CREATE MATERIALIZED VIEW IF NOT EXISTS application_sla_realtime
ENGINE = AggregatingMergeTree()
ORDER BY (application_id, window_start)
AS SELECT
    application_id,
    tumbleStart(check_time, INTERVAL 1 HOUR) as window_start,
    count() as total_checks,
    countIf(status = 'healthy') as healthy_checks,
    countIf(status = 'degraded') as degraded_checks,
    countIf(status = 'down') as down_checks,
    (healthy_checks * 100.0) / total_checks as availability_percentage,
    avg(response_time_ms) as avg_response_time,
    quantile(0.95)(response_time_ms) as p95_response_time,
    quantile(0.99)(response_time_ms) as p99_response_time
FROM health_checks
GROUP BY application_id, window_start;

-- Indexes for better query performance
ALTER TABLE applications ADD INDEX idx_status (status) TYPE set(0) GRANULARITY 4;
ALTER TABLE applications ADD INDEX idx_team (team) TYPE bloom_filter() GRANULARITY 4;
ALTER TABLE health_checks ADD INDEX idx_app_status (application_id, status) TYPE minmax GRANULARITY 4;

-- Sample data insertion (for testing)
-- This will be commented out in production
/*
INSERT INTO applications (id, name, team, namespace, health_check_url, environment) VALUES
    ('app-001', 'appsentry-backend', 'platform', 'appsentry-system', 'http://localhost:3001/health', 'development'),
    ('app-002', 'appsentry-frontend', 'platform', 'appsentry-system', 'http://localhost:3000/health.json', 'development');
*/