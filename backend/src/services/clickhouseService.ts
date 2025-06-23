import { createClient, ClickHouseClient } from '@clickhouse/client';
import { logger } from '../utils/logger';

interface ClickHouseConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
}

interface TraceData {
  timestamp: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  operation_name: string;
  service_name: string;
  service_version: string;
  duration_ns: string;
  status_code: number;
  status_message: string;
  span_kind: string;
  resource_attributes: Record<string, string>;
  span_attributes: Record<string, string>;
}

interface MetricData {
  timestamp: string;
  metric_name: string;
  metric_type: string;
  service_name: string;
  service_version: string;
  value: number;
  resource_attributes: Record<string, string>;
  metric_attributes: Record<string, string>;
}

interface LogData {
  timestamp: string;
  trace_id?: string;
  span_id?: string;
  severity_text: string;
  severity_number: number;
  body: string;
  service_name: string;
  service_version: string;
  resource_attributes: Record<string, string>;
  log_attributes: Record<string, string>;
}

class ClickHouseService {
  private client: ClickHouseClient;
  private config: ClickHouseConfig;

  constructor() {
    this.config = {
      host: process.env.CLICKHOUSE_HOST || 'localhost',
      port: parseInt(process.env.CLICKHOUSE_PORT || '8123'),
      database: process.env.CLICKHOUSE_DATABASE || 'otel',
      username: process.env.CLICKHOUSE_USERNAME || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    };

    this.client = createClient({
      url: `http://${this.config.host}:${this.config.port}`,
      database: this.config.database,
      username: this.config.username,
      password: this.config.password,
    });

    logger.info('ClickHouse service initialized', {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
    });
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result.success;
    } catch (error) {
      logger.error('ClickHouse ping failed', { error });
      return false;
    }
  }

  async insertTraces(traces: any[]): Promise<void> {
    try {
      if (traces.length === 0) return;


      await this.client.insert({
        table: 'otel.traces',
        values: traces,
        format: 'JSONEachRow',
      });

      logger.info('Inserted traces into ClickHouse', {
        operation: 'clickhouse_insert',
        table: 'otel.traces',
        record_count: traces.length,
        data_type: 'traces'
      });
    } catch (error) {
      logger.error('Failed to insert traces into ClickHouse', { error });
      throw error;
    }
  }

  async insertMetrics(metrics: any[]): Promise<void> {
    try {
      if (metrics.length === 0) return;


      // Insert into the correct metrics table (defaulting to metrics_sum for now)
      await this.client.insert({
        table: 'otel.metrics_sum',
        values: metrics,
        format: 'JSONEachRow',
      });

      logger.info('Inserted metrics into ClickHouse', {
        operation: 'clickhouse_insert',
        table: 'otel.metrics_sum',
        record_count: metrics.length,
        data_type: 'metrics'
      });
    } catch (error) {
      logger.error('Failed to insert metrics into ClickHouse', { error });
      throw error;
    }
  }

  async insertLogs(logs: any[]): Promise<void> {
    try {
      if (logs.length === 0) return;

      await this.client.insert({
        table: 'otel.logs',
        values: logs,
        format: 'JSONEachRow',
      });

      // Use console.log to avoid infinite logging loops
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Inserted', logs.length, 'logs into ClickHouse');
      }
    } catch (error) {
      logger.error('Failed to insert logs into ClickHouse', { error });
      throw error;
    }
  }

  async getTraces(options: {
    timeRange?: string;
    serviceName?: string;
    operationName?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const { timeRange = '1h', serviceName, operationName, limit = 100 } = options;
      
      let whereClause = `WHERE Timestamp >= now() - INTERVAL ${this.parseTimeRange(timeRange)}`;
      
      if (serviceName) {
        whereClause += ` AND ServiceName = '${serviceName}'`;
      }
      
      if (operationName) {
        whereClause += ` AND SpanName ILIKE '%${operationName}%'`;
      }

      const query = `
        SELECT 
          TraceId as trace_id,
          SpanId as span_id,
          ParentSpanId as parent_span_id,
          SpanName as operation_name,
          ServiceName as service_name,
          Timestamp as timestamp,
          Duration as duration_ns,
          StatusCode as status_code,
          StatusMessage as status_message,
          SpanKind as span_kind,
          ResourceAttributes as resource_attributes,
          SpanAttributes as span_attributes
        FROM otel.traces 
        ${whereClause}
        ORDER BY Timestamp DESC 
        LIMIT ${limit}
      `;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      logger.error('Failed to query traces from ClickHouse', { error });
      throw error;
    }
  }

  async getMetrics(options: {
    timeRange?: string;
    serviceName?: string;
    metricName?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const { timeRange = '1h', serviceName, metricName, limit = 1000 } = options;
      
      let whereClause = `WHERE TimeUnix >= now() - INTERVAL ${this.parseTimeRange(timeRange)}`;
      
      if (serviceName) {
        const serviceFilter = `ResourceAttributes['service.name'] = '${serviceName}'`;
        whereClause += ` AND ${serviceFilter}`;
      }
      
      if (metricName) {
        whereClause += ` AND MetricName = '${metricName}'`;
      }

      const query = `
        SELECT 
          TimeUnix as timestamp,
          MetricName as metric_name,
          'gauge' as metric_type,
          ResourceAttributes['service.name'] as service_name,
          ResourceAttributes['service.version'] as service_version,
          Value as value,
          ResourceAttributes as resource_attributes,
          Attributes as metric_attributes
        FROM otel.metrics_gauge 
        ${whereClause}
        
        UNION ALL
        
        SELECT 
          TimeUnix as timestamp,
          MetricName as metric_name,
          'sum' as metric_type,
          ResourceAttributes['service.name'] as service_name,
          ResourceAttributes['service.version'] as service_version,
          Value as value,
          ResourceAttributes as resource_attributes,
          Attributes as metric_attributes
        FROM otel.metrics_sum 
        ${whereClause}
        
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      logger.error('Failed to query metrics from ClickHouse', { error });
      throw error;
    }
  }

  async getLogs(options: {
    timeRange?: string;
    serviceName?: string;
    severityLevel?: string;
    searchTerm?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      const { timeRange = '1h', serviceName, severityLevel, searchTerm, limit = 100 } = options;
      
      let whereClause = `WHERE Timestamp >= now() - INTERVAL ${this.parseTimeRange(timeRange)}`;
      
      if (serviceName) {
        whereClause += ` AND (ServiceName = '${serviceName}' OR ResourceAttributes['service.name'] = '${serviceName}')`;
      }
      
      if (severityLevel) {
        whereClause += ` AND SeverityText = '${severityLevel}'`;
      }
      
      if (searchTerm) {
        whereClause += ` AND Body ILIKE '%${searchTerm}%'`;
      }

      const query = `
        SELECT 
          Timestamp as timestamp,
          TraceId as trace_id,
          SpanId as span_id,
          SeverityText as severity_text,
          SeverityNumber as severity_number,
          Body as body,
          COALESCE(
            NULLIF(ServiceName, ''), 
            ResourceAttributes['service.name'],
            ResourceAttributes['k8s.namespace.name'],
            'system'
          ) as service_name,
          ResourceAttributes as resource_attributes,
          LogAttributes as log_attributes
        FROM otel.logs 
        ${whereClause}
        ORDER BY Timestamp DESC 
        LIMIT ${limit}
      `;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      logger.error('Failed to query logs from ClickHouse', { error });
      throw error;
    }
  }

  async getTraceById(traceId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          TraceId as trace_id,
          SpanId as span_id,
          ParentSpanId as parent_span_id,
          SpanName as operation_name,
          ServiceName as service_name,
          Timestamp as timestamp,
          Duration as duration_ns,
          StatusCode as status_code,
          StatusMessage as status_message,
          SpanKind as span_kind,
          ResourceAttributes as resource_attributes,
          SpanAttributes as span_attributes
        FROM otel.traces 
        WHERE TraceId = '${traceId}'
        ORDER BY Timestamp ASC
      `;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      logger.error('Failed to query trace by ID from ClickHouse', { error });
      throw error;
    }
  }

  async getMetricsSummary(timeRange = '1h'): Promise<any> {
    try {
      const query = `
        SELECT 
          ResourceAttributes['service.name'] as service_name,
          MetricName as metric_name,
          'gauge' as metric_type,
          avg(Value) as avg_value,
          max(Value) as max_value,
          min(Value) as min_value,
          count() as data_points
        FROM otel.metrics_gauge 
        WHERE TimeUnix >= now() - INTERVAL ${this.parseTimeRange(timeRange)}
        GROUP BY service_name, metric_name
        
        UNION ALL
        
        SELECT 
          ResourceAttributes['service.name'] as service_name,
          MetricName as metric_name,
          'sum' as metric_type,
          avg(Value) as avg_value,
          max(Value) as max_value,
          min(Value) as min_value,
          count() as data_points
        FROM otel.metrics_sum 
        WHERE TimeUnix >= now() - INTERVAL ${this.parseTimeRange(timeRange)}
        GROUP BY service_name, metric_name
        
        ORDER BY service_name, metric_name
      `;

      const result = await this.client.query({
        query,
        format: 'JSONEachRow',
      });

      return await result.json();
    } catch (error) {
      logger.error('Failed to query metrics summary from ClickHouse', { error });
      throw error;
    }
  }

  private parseTimeRange(timeRange: string): string {
    const ranges = {
      '5m': '5 MINUTE',
      '15m': '15 MINUTE',
      '1h': '1 HOUR',
      '6h': '6 HOUR',
      '24h': '1 DAY',
      '7d': '7 DAY',
    };
    
    return ranges[timeRange as keyof typeof ranges] || '1 HOUR';
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
      logger.info('ClickHouse client connection closed');
    } catch (error) {
      logger.error('Error closing ClickHouse client', { error });
    }
  }
}

export const clickHouseService = new ClickHouseService();
export { ClickHouseService, TraceData, MetricData, LogData };