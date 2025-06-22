import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { metrics, trace } from '@opentelemetry/api';

const router = Router();
const meter = metrics.getMeter('appsentry-test', '1.0.0');
const tracer = trace.getTracer('appsentry-test', '1.0.0');

// Test metrics
const testCounter = meter.createCounter('test_operations_total', {
  description: 'Total number of test operations',
});

const testGauge = meter.createUpDownCounter('test_active_connections', {
  description: 'Number of active test connections',
});

const testHistogram = meter.createHistogram('test_operation_duration_ms', {
  description: 'Duration of test operations in milliseconds',
});

// Generate sample telemetry data
router.post('/generate-sample-data', async (req: Request, res: Response) => {
  try {
    logger.info('Starting telemetry data generation');
    
    // Create a span for this operation
    const span = tracer.startSpan('generate_sample_telemetry');
    
    
    logger.info('Created span', {
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      traceFlags: span.spanContext().traceFlags
    });
    
    try {
      // Simulate various operations with different durations and outcomes
      for (let i = 0; i < 10; i++) {
        const operationSpan = tracer.startSpan(`sample_operation_${i}`, { parent: span });
        const startTime = Date.now();
        
        try {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
          
          const duration = Date.now() - startTime;
          const success = Math.random() > 0.2; // 80% success rate
          
          // Record metrics
          testCounter.add(1, {
            operation: `operation_${i % 3}`,
            status: success ? 'success' : 'error',
            service: 'appsentry-backend'
          });
          
          testHistogram.record(duration, {
            operation: `operation_${i % 3}`,
            status: success ? 'success' : 'error'
          });
          
          // Log the operation and send to OTEL logs endpoint
          const logData = {
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            trace_id: operationSpan.spanContext().traceId,
            span_id: operationSpan.spanContext().spanId,
            severity_text: success ? 'INFO' : 'ERROR',
            severity_number: success ? 9 : 17,
            body: success ? `Sample operation ${i} completed successfully` : `Sample operation ${i} failed`,
            service_name: 'appsentry-backend',
            service_version: '1.0.0',
            resource_attributes: {
              'service.name': 'appsentry-backend',
              'service.version': '1.0.0'
            },
            log_attributes: {
              'operation.id': i.toString(),
              'operation.duration_ms': duration.toString(),
              'operation.success': success.toString()
            }
          };

          // Send log to OTEL logs endpoint
          try {
            await fetch('http://localhost:3001/api/otel/v1/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resourceLogs: [{
                  resource: {
                    attributes: [
                      { key: 'service.name', value: { stringValue: 'appsentry-backend' } },
                      { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                  },
                  scopeLogs: [{
                    logRecords: [{
                      timeUnixNano: (Date.now() * 1000000).toString(),
                      severityText: logData.severity_text,
                      severityNumber: logData.severity_number,
                      body: { stringValue: logData.body },
                      traceId: logData.trace_id,
                      spanId: logData.span_id,
                      attributes: Object.entries(logData.log_attributes).map(([key, value]) => ({
                        key,
                        value: { stringValue: value }
                      }))
                    }]
                  }]
                }]
              })
            });
          } catch (logError) {
            // Ignore log export errors
          }

          if (success) {
            logger.info(`Sample operation ${i} completed successfully`, {
              operationId: i,
              duration: `${duration}ms`,
              traceId: operationSpan.spanContext().traceId,
              spanId: operationSpan.spanContext().spanId
            });
          } else {
            logger.error(`Sample operation ${i} failed`, {
              operationId: i,
              duration: `${duration}ms`,
              error: 'Simulated error for testing',
              traceId: operationSpan.spanContext().traceId,
              spanId: operationSpan.spanContext().spanId
            });
          }
          
          operationSpan.setStatus({ code: success ? 1 : 2 }); // OK or ERROR
          operationSpan.setAttributes({
            'operation.id': i,
            'operation.type': `type_${i % 3}`,
            'operation.duration_ms': duration,
            'operation.success': success
          });
          
        } catch (error) {
          operationSpan.recordException(error as Error);
          operationSpan.setStatus({ code: 2, message: (error as Error).message });
          throw error;
        } finally {
          operationSpan.end();
        }
      }
      
      // Update gauge metric
      testGauge.add(Math.floor(Math.random() * 10) + 1, {
        service: 'appsentry-backend'
      });
      
      span.setAttributes({
        'generation.operations_count': 10,
        'generation.success': true
      });
      
      logger.info('Sample telemetry data generated successfully', {
        operationsGenerated: 10,
        traceId: span.spanContext().traceId
      });
      
      logger.info('Ending main span', {
        traceId: span.spanContext().traceId
      });
      
      res.json({
        success: true,
        message: 'Sample telemetry data generated',
        operationsGenerated: 10,
        traceId: span.spanContext().traceId
      });
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
      
      // Force flush for immediate export in development
      setTimeout(async () => {
        try {
          const provider = trace.getTracerProvider() as any;
          if (provider && provider.activeSpanProcessor && provider.activeSpanProcessor.forceFlush) {
            await provider.activeSpanProcessor.forceFlush();
            logger.info('Forced span processor flush');
          }
        } catch (error) {
          logger.debug('Could not force flush span processor', { error });
        }
      }, 100);
    }
    
  } catch (error) {
    logger.error('Failed to generate sample telemetry data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate sample telemetry data'
    });
  }
});

// Generate continuous sample data
router.post('/start-continuous-generation', async (req: Request, res: Response) => {
  try {
    // Start a background process to generate telemetry data every 10 seconds
    const interval = setInterval(async () => {
      try {
        const span = tracer.startSpan('background_telemetry_generation');
        
        // Generate random metrics
        testCounter.add(1, {
          operation: 'background_task',
          status: Math.random() > 0.1 ? 'success' : 'error',
          service: 'appsentry-background'
        });
        
        testHistogram.record(Math.random() * 200 + 50, {
          operation: 'background_task'
        });
        
        testGauge.add(Math.floor(Math.random() * 5) - 2, {
          service: 'appsentry-background'
        });
        
        // Generate random log
        if (Math.random() > 0.7) {
          logger.warn('Background process warning', {
            processId: 'bg-001',
            memoryUsage: Math.floor(Math.random() * 100) + 50,
            traceId: span.spanContext().traceId
          });
        } else {
          logger.info('Background process heartbeat', {
            processId: 'bg-001',
            status: 'healthy',
            traceId: span.spanContext().traceId
          });
        }
        
        span.end();
      } catch (error) {
        logger.error('Background telemetry generation error', { error });
      }
    }, 10000);
    
    // Store interval ID for cleanup (in a real app, you'd want to manage this properly)
    (global as any).telemetryInterval = interval;
    
    logger.info('Started continuous telemetry generation');
    
    res.json({
      success: true,
      message: 'Continuous telemetry generation started',
      intervalMs: 10000
    });
    
  } catch (error) {
    logger.error('Failed to start continuous telemetry generation', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start continuous generation'
    });
  }
});

// Stop continuous generation
router.post('/stop-continuous-generation', async (req: Request, res: Response) => {
  try {
    const interval = (global as any).telemetryInterval;
    if (interval) {
      clearInterval(interval);
      delete (global as any).telemetryInterval;
      
      logger.info('Stopped continuous telemetry generation');
      
      res.json({
        success: true,
        message: 'Continuous telemetry generation stopped'
      });
    } else {
      res.json({
        success: true,
        message: 'No continuous generation was running'
      });
    }
  } catch (error) {
    logger.error('Failed to stop continuous telemetry generation', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to stop continuous generation'
    });
  }
});

export default router;