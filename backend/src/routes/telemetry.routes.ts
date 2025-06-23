import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { metrics, trace } from '@opentelemetry/api';

const router = Router();
const meter = metrics.getMeter('appsentry-telemetry', '1.0.0');
const tracer = trace.getTracer('appsentry-telemetry', '1.0.0');

// Real application metrics
const apiRequestCounter = meter.createCounter('api_requests_total', {
  description: 'Total number of API requests',
});

const healthCheckCounter = meter.createCounter('health_checks_total', {
  description: 'Total number of health checks performed',
});

const databaseOperationHistogram = meter.createHistogram('database_operation_duration_ms', {
  description: 'Duration of database operations in milliseconds',
});

// Get telemetry configuration
router.get('/config', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
        serviceName: 'AppSentry Backend',
        serviceVersion: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        instrumentations: [
          'http',
          'express',
          'clickhouse',
          'kubernetes'
        ]
      }
    });
  } catch (error) {
    logger.error('Failed to get telemetry config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get telemetry configuration'
    });
  }
});

// Manual metric recording (for testing real metrics)
router.post('/record-metric', async (req: Request, res: Response) => {
  try {
    const { type, name, value, labels } = req.body;
    
    if (!type || !name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, name, value'
      });
    }

    const span = tracer.startSpan('manual_metric_recording');
    
    try {
      switch (type) {
        case 'counter':
          apiRequestCounter.add(value, labels || {});
          break;
        case 'histogram':
          databaseOperationHistogram.record(value, labels || {});
          break;
        default:
          throw new Error(`Unsupported metric type: ${type}`);
      }

      span.setAttributes({
        'metric.type': type,
        'metric.name': name,
        'metric.value': value,
        'metric.labels': JSON.stringify(labels || {})
      });

      logger.info('Metric recorded manually', {
        type,
        name,
        value,
        labels,
        traceId: span.spanContext().traceId
      });

      res.json({
        success: true,
        message: 'Metric recorded successfully',
        metric: { type, name, value, labels }
      });

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }

  } catch (error) {
    logger.error('Failed to record metric:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record metric'
    });
  }
});

// Manual trace generation for testing real AppSentry operations
router.post('/generate-trace', async (req: Request, res: Response) => {
  const span = tracer.startSpan('appsentry_operation');
  
  try {
    // Simulate real AppSentry operations
    const operationType = req.body.operation || 'dashboard_load';
    const userId = req.body.userId || 'admin';
    
    logger.info('Starting trace generation operation', {
      operation: operationType,
      userId: userId,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
    
    span.setAttributes({
      'operation.type': operationType,
      'operation.user': userId,
      'http.method': 'POST',
      'http.route': '/api/telemetry/generate-trace',
      'service.name': 'AppSentry Backend',
      'component': 'telemetry'
    });

    // Simulate authentication check
    logger.debug('Verifying user permissions', { userId });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));

    // Simulate some work
    logger.info('Processing operation', { operation: operationType });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    // Simulate a child span
    const childSpan = tracer.startSpan('database_query', { parent: span });
    childSpan.setAttributes({
      'db.system': 'clickhouse',
      'db.statement': 'SELECT * FROM traces LIMIT 100',
      'db.operation': 'SELECT'
    });
    
    logger.debug('Executing database query', {
      query: 'SELECT * FROM traces LIMIT 100',
      database: 'clickhouse'
    });
    
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 25));
    logger.debug('Database query completed successfully');
    childSpan.end();

    // Record metrics
    apiRequestCounter.add(1, {
      operation: operationType,
      status: 'success'
    });

    logger.info('Trace generation completed successfully', {
      operation: operationType,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      duration: Date.now() - (span as any).startTime
    });

    res.json({
      success: true,
      message: 'Trace generated successfully',
      traceId: span.spanContext().traceId,
      operation: operationType
    });

    span.setStatus({ code: 1 }); // OK
    span.end();
  } catch (error) {
    logger.error('Failed to generate trace', {
      error: error instanceof Error ? error.message : error,
      operation: req.body.operation,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    span.end();
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate trace'
    });
  }
});

// Generate logs linked to actual traces
router.post('/generate-trace-logs', async (req: Request, res: Response) => {
  const span = tracer.startSpan('generate_trace_logs');
  
  try {
    const { clickHouseService } = require('../services/clickhouseService');
    
    // Get recent traces to link logs to
    const recentTraces = await clickHouseService.getTraces({
      timeRange: '5m',
      limit: 5
    });

    const logEntries = [];
    const currentTraceId = span.spanContext().traceId;
    const currentSpanId = span.spanContext().spanId;

    // Generate logs for current operation
    const operationLogs = [
      { level: 'INFO', message: 'Starting trace-linked log generation operation', time: 0 },
      { level: 'DEBUG', message: 'Querying ClickHouse for recent traces', time: 50 },
      { level: 'INFO', message: `Found ${recentTraces.length} recent traces for log correlation`, time: 100 },
      { level: 'DEBUG', message: 'Generating correlated log entries', time: 150 },
      { level: 'INFO', message: 'Trace-linked logs generated successfully', time: 200 }
    ];

    operationLogs.forEach((log, index) => {
      const timestamp = new Date(Date.now() + log.time);
      
      logEntries.push({
        Timestamp: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
        TraceId: currentTraceId,
        SpanId: currentSpanId,
        TraceFlags: 0,
        SeverityText: log.level,
        SeverityNumber: log.level === 'ERROR' ? 17 : log.level === 'WARN' ? 13 : log.level === 'INFO' ? 9 : 5,
        ServiceName: 'AppSentry Backend',
        Body: log.message,
        ResourceSchemaUrl: '',
        ResourceAttributes: {
          'service.name': 'AppSentry Backend',
          'service.version': '1.0.0',
          'deployment.environment': 'development'
        },
        ScopeSchemaUrl: '',
        ScopeName: 'winston',
        ScopeVersion: '1.0.0',
        ScopeAttributes: {},
        LogAttributes: {
          'log.logger': 'winston',
          'log.level': log.level.toLowerCase(),
          'operation.name': 'generate_trace_logs',
          'operation.step': index + 1,
          'log.correlation': 'trace_linked'
        }
      });

      // Also log with winston to show console correlation
      const logLevel = log.level.toLowerCase();
      if (logLevel === 'debug') {
        logger.debug(`${log.message} [step=${index + 1}]`);
      } else if (logLevel === 'info') {
        logger.info(`${log.message} [step=${index + 1}]`);
      } else if (logLevel === 'warn') {
        logger.warn(`${log.message} [step=${index + 1}]`);
      } else if (logLevel === 'error') {
        logger.error(`${log.message} [step=${index + 1}]`);
      }
    });

    // Generate logs for existing traces
    recentTraces.forEach((trace: any, index: number) => {
      const logMessages = [
        `Trace ${trace.trace_id.substring(0, 8)} processed successfully`,
        `Operation "${trace.operation_name}" completed in ${parseFloat(trace.duration_ns) / 1000000}ms`,
        `Service "${trace.service_name}" reported status: ${trace.status_code === '0' ? 'OK' : 'ERROR'}`
      ];

      logMessages.forEach((message, msgIndex) => {
        const timestamp = new Date(Date.now() - Math.random() * 300000);
        
        logEntries.push({
          Timestamp: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
          TraceId: trace.trace_id,
          SpanId: trace.span_id,
          TraceFlags: 0,
          SeverityText: trace.status_code === '0' ? 'INFO' : 'ERROR',
          SeverityNumber: trace.status_code === '0' ? 9 : 17,
          ServiceName: trace.service_name,
          Body: message,
          ResourceSchemaUrl: '',
          ResourceAttributes: {
            'service.name': trace.service_name,
            'service.version': '1.0.0',
            'deployment.environment': 'development'
          },
          ScopeSchemaUrl: '',
          ScopeName: 'winston',
          ScopeVersion: '1.0.0',
          ScopeAttributes: {},
          LogAttributes: {
            'log.logger': 'winston',
            'log.level': trace.status_code === '0' ? 'info' : 'error',
            'operation.name': trace.operation_name,
            'trace.correlated': 'true',
            'log.source': 'post_processing'
          }
        });
      });
    });

    // Insert all logs
    await clickHouseService.insertLogs(logEntries);
    
    span.setAttributes({
      'logs.generated': logEntries.length,
      'traces.correlated': recentTraces.length,
      'operation.type': 'generate_trace_logs'
    });

    logger.info('Trace-linked logs generated successfully', {
      totalLogs: logEntries.length,
      correlatedTraces: recentTraces.length,
      currentTraceId: currentTraceId
    });

    res.json({
      success: true,
      message: `Generated ${logEntries.length} trace-linked logs`,
      details: {
        totalLogs: logEntries.length,
        correlatedTraces: recentTraces.length,
        currentTraceId: currentTraceId
      }
    });

    span.setStatus({ code: 1 });
    span.end();

  } catch (error) {
    logger.error('Failed to generate trace-linked logs', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    span.end();
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate trace-linked logs'
    });
  }
});

// Generate sample logs for demonstration
router.post('/generate-logs', async (req: Request, res: Response) => {
  try {
    const { clickHouseService } = require('../services/clickhouseService');
    const count = req.body.count || 5;
    
    const sampleLogs = [];
    const logLevels = ['INFO', 'DEBUG', 'WARN', 'ERROR'];
    const operations = [
      'User authentication successful',
      'Database query executed',
      'Health check completed',
      'Application stats calculated',
      'Platform metrics retrieved',
      'Trace generation completed',
      'Cache operation performed',
      'Configuration loaded',
      'Service connection established',
      'Request processing finished'
    ];

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(Date.now() - Math.random() * 300000); // Last 5 minutes
      const level = logLevels[Math.floor(Math.random() * logLevels.length)];
      const operation = operations[Math.floor(Math.random() * operations.length)];
      const traceId = Math.random().toString(16).substring(2, 18).padEnd(32, '0');
      const spanId = Math.random().toString(16).substring(2, 10).padEnd(16, '0');

      const logRecord = {
        Timestamp: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
        TraceId: traceId,
        SpanId: spanId,
        TraceFlags: 0,
        SeverityText: level,
        SeverityNumber: level === 'ERROR' ? 17 : level === 'WARN' ? 13 : level === 'INFO' ? 9 : 5,
        ServiceName: 'AppSentry Backend',
        Body: operation,
        ResourceSchemaUrl: '',
        ResourceAttributes: {
          'service.name': 'AppSentry Backend',
          'service.version': '1.0.0',
          'deployment.environment': 'development'
        },
        ScopeSchemaUrl: '',
        ScopeName: 'winston',
        ScopeVersion: '1.0.0',
        ScopeAttributes: {},
        LogAttributes: {
          'log.logger': 'winston',
          'log.level': level.toLowerCase(),
          'operation.type': operation.split(' ')[0].toLowerCase()
        }
      };

      sampleLogs.push(logRecord);
    }

    // Insert logs into ClickHouse
    await clickHouseService.insertLogs(sampleLogs);
    
    logger.info('Sample logs generated successfully', {
      count: sampleLogs.length,
      levels: logLevels
    });

    res.json({
      success: true,
      message: `Generated ${sampleLogs.length} sample logs`,
      count: sampleLogs.length
    });

  } catch (error) {
    logger.error('Failed to generate sample logs', {
      error: error instanceof Error ? error.message : error
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample logs'
    });
  }
});

// Health endpoint for telemetry service
router.get('/health', (req: Request, res: Response) => {
  try {
    const span = tracer.startSpan('telemetry_health_check');
    
    // Record a health check metric
    healthCheckCounter.add(1, {
      service: 'telemetry',
      status: 'healthy'
    });

    span.setAttributes({
      'health.status': 'healthy',
      'health.service': 'telemetry'
    });

    res.json({
      success: true,
      status: 'healthy',
      service: 'telemetry',
      timestamp: new Date().toISOString()
    });

    span.end();
  } catch (error) {
    logger.error('Telemetry health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

export default router;