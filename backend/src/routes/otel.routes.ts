import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { clickHouseService, TraceData, MetricData, LogData } from '../services/clickhouseService';

const router = Router();

// OTEL Traces endpoint
router.post('/v1/traces', async (req: Request, res: Response) => {
  try {
    const traces = req.body;
    
    // Log received traces for debugging
    logger.info('Received OTEL traces', {
      count: traces?.resourceSpans?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Transform and store traces in ClickHouse
    const traceData: TraceData[] = [];
    
    if (traces?.resourceSpans) {
      traces.resourceSpans.forEach((resourceSpan: any) => {
        const resourceAttributes = resourceSpan.resource?.attributes || {};
        const serviceName = resourceAttributes.find((attr: any) => attr.key === 'service.name')?.value?.stringValue || 'unknown';
        const serviceVersion = resourceAttributes.find((attr: any) => attr.key === 'service.version')?.value?.stringValue || '1.0.0';
        
        resourceSpan.scopeSpans?.forEach((scopeSpan: any) => {
          scopeSpan.spans?.forEach((span: any) => {
            // Convert nanoseconds to milliseconds
            const startTime = new Date(parseInt(span.startTimeUnixNano) / 1000000);
            const endTime = new Date(parseInt(span.endTimeUnixNano) / 1000000);
            const duration = parseInt(span.endTimeUnixNano) - parseInt(span.startTimeUnixNano);
            
            const spanAttributes: Record<string, string> = {};
            span.attributes?.forEach((attr: any) => {
              if (attr.value?.stringValue !== undefined) {
                spanAttributes[attr.key] = attr.value.stringValue;
              } else if (attr.value?.intValue !== undefined) {
                spanAttributes[attr.key] = attr.value.intValue.toString();
              } else if (attr.value?.boolValue !== undefined) {
                spanAttributes[attr.key] = attr.value.boolValue.toString();
              } else if (attr.value?.doubleValue !== undefined) {
                spanAttributes[attr.key] = attr.value.doubleValue.toString();
              } else {
                spanAttributes[attr.key] = '';
              }
            });

            const resourceAttrs: Record<string, string> = {};
            resourceAttributes.forEach((attr: any) => {
              resourceAttrs[attr.key] = attr.value?.stringValue || attr.value?.intValue?.toString() || '';
            });

            // Override service name if it's the auto-detected one
            let cleanServiceName = serviceName;
            if (serviceName.includes('unknown_service:') || serviceName.includes('/node')) {
              cleanServiceName = 'AppSentry Backend';
              resourceAttrs['service.name'] = 'AppSentry Backend';
            }

            // Create minimal trace record with only required fields
            const traceRecord: any = {
              Timestamp: startTime.toISOString().replace('T', ' ').replace('Z', ''),
              TraceId: span.traceId || '',
              SpanId: span.spanId || '',
              ParentSpanId: span.parentSpanId || '',
              TraceState: '',
              SpanName: span.name || '',
              SpanKind: span.kind?.toString() || '1',
              ServiceName: cleanServiceName || 'unknown',
              ResourceAttributes: resourceAttrs,
              ScopeName: scopeSpan.scope?.name || '',
              ScopeVersion: scopeSpan.scope?.version || '',
              SpanAttributes: spanAttributes,
              Duration: duration,
              StatusCode: span.status?.code?.toString() || '0',
              StatusMessage: span.status?.message || ''
            };

            // Add array fields as empty arrays (flattened format)
            traceRecord['Events.Timestamp'] = [];
            traceRecord['Events.Name'] = [];
            traceRecord['Events.Attributes'] = [];
            traceRecord['Links.TraceId'] = [];
            traceRecord['Links.SpanId'] = [];
            traceRecord['Links.TraceState'] = [];
            traceRecord['Links.Attributes'] = [];

            traceData.push(traceRecord);
          });
        });
      });
    }

    // Insert traces into ClickHouse
    if (traceData.length > 0) {
      await clickHouseService.insertTraces(traceData);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process OTEL traces', { error });
    res.status(500).json({ error: 'Failed to process traces' });
  }
});

// OTEL Metrics endpoint  
router.post('/v1/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = req.body;
    
    logger.info('Received OTEL metrics', {
      count: metrics?.resourceMetrics?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Transform and store metrics in ClickHouse with correct schema
    const metricData: any[] = [];
    
    if (metrics?.resourceMetrics) {
      metrics.resourceMetrics.forEach((resourceMetric: any) => {
        const resourceAttributes = resourceMetric.resource?.attributes || {};
        
        const resourceAttrs: Record<string, string> = {};
        resourceAttributes.forEach((attr: any) => {
          resourceAttrs[attr.key] = attr.value?.stringValue || attr.value?.intValue?.toString() || '';
        });

        // Override service name if needed for metrics
        const serviceName = resourceAttributes.find((attr: any) => attr.key === 'service.name')?.value?.stringValue || 'unknown';
        if (serviceName.includes('unknown_service:') || serviceName.includes('/node')) {
          resourceAttrs['service.name'] = 'AppSentry Backend';
        }
        
        resourceMetric.scopeMetrics?.forEach((scopeMetric: any) => {
          scopeMetric.metrics?.forEach((metric: any) => {
            
            // Process sum metrics (counters)
            if (metric.sum?.dataPoints) {
              metric.sum.dataPoints.forEach((dataPoint: any) => {
                const timestamp = new Date(parseInt(dataPoint.timeUnixNano) / 1000000);
                const startTime = new Date(parseInt(dataPoint.startTimeUnixNano) / 1000000);
                
                const metricAttrs: Record<string, string> = {};
                dataPoint.attributes?.forEach((attr: any) => {
                  if (attr.value?.stringValue !== undefined) {
                    metricAttrs[attr.key] = attr.value.stringValue;
                  } else if (attr.value?.intValue !== undefined) {
                    metricAttrs[attr.key] = attr.value.intValue.toString();
                  }
                });

                const metricRecord = {
                  ResourceAttributes: resourceAttrs,
                  ResourceSchemaUrl: '',
                  ScopeName: scopeMetric.scope?.name || '',
                  ScopeVersion: scopeMetric.scope?.version || '',
                  ScopeAttributes: {},
                  ScopeDroppedAttrCount: 0,
                  ScopeSchemaUrl: '',
                  MetricName: metric.name,
                  MetricDescription: metric.description || '',
                  MetricUnit: metric.unit || '',
                  Attributes: metricAttrs,
                  StartTimeUnix: startTime.toISOString().replace('T', ' ').replace('Z', ''),
                  TimeUnix: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
                  Value: dataPoint.asDouble || dataPoint.asInt || 0,
                  Flags: 0,
                  'Exemplars.FilteredAttributes': [],
                  'Exemplars.TimeUnix': [],
                  'Exemplars.Value': [],
                  'Exemplars.SpanId': [],
                  'Exemplars.TraceId': [],
                  AggTemp: 0,
                  IsMonotonic: true
                };

                metricData.push(metricRecord);
              });
            }

            // Process histogram metrics
            if (metric.histogram?.dataPoints) {
              metric.histogram.dataPoints.forEach((dataPoint: any) => {
                const timestamp = new Date(parseInt(dataPoint.timeUnixNano) / 1000000);
                const startTime = new Date(parseInt(dataPoint.startTimeUnixNano) / 1000000);
                
                const metricAttrs: Record<string, string> = {};
                dataPoint.attributes?.forEach((attr: any) => {
                  if (attr.value?.stringValue !== undefined) {
                    metricAttrs[attr.key] = attr.value.stringValue;
                  } else if (attr.value?.intValue !== undefined) {
                    metricAttrs[attr.key] = attr.value.intValue.toString();
                  }
                });

                // For histograms, store the sum as a sum metric
                const metricRecord = {
                  ResourceAttributes: resourceAttrs,
                  ResourceSchemaUrl: '',
                  ScopeName: scopeMetric.scope?.name || '',
                  ScopeVersion: scopeMetric.scope?.version || '',
                  ScopeAttributes: {},
                  ScopeDroppedAttrCount: 0,
                  ScopeSchemaUrl: '',
                  MetricName: metric.name,
                  MetricDescription: metric.description || '',
                  MetricUnit: metric.unit || '',
                  Attributes: metricAttrs,
                  StartTimeUnix: startTime.toISOString().replace('T', ' ').replace('Z', ''),
                  TimeUnix: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
                  Value: dataPoint.sum || 0,
                  Flags: 0,
                  'Exemplars.FilteredAttributes': [],
                  'Exemplars.TimeUnix': [],
                  'Exemplars.Value': [],
                  'Exemplars.SpanId': [],
                  'Exemplars.TraceId': [],
                  AggTemp: 0,
                  IsMonotonic: false
                };

                metricData.push(metricRecord);
              });
            }
          });
        });
      });
    }

    // Insert metrics into ClickHouse
    if (metricData.length > 0) {
      await clickHouseService.insertMetrics(metricData);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process OTEL metrics', { error });
    res.status(500).json({ error: 'Failed to process metrics' });
  }
});

// OTEL Logs endpoint
router.post('/v1/logs', async (req: Request, res: Response) => {
  try {
    const logs = req.body;
    
    logger.info('Received OTEL logs', {
      count: logs?.resourceLogs?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Transform and store logs in ClickHouse
    const logData: any[] = [];
    
    if (logs?.resourceLogs) {
      logs.resourceLogs.forEach((resourceLog: any) => {
        const resourceAttributes = resourceLog.resource?.attributes || {};
        const serviceName = resourceAttributes.find((attr: any) => attr.key === 'service.name')?.value?.stringValue || 'unknown';
        
        const resourceAttrs: Record<string, string> = {};
        resourceAttributes.forEach((attr: any) => {
          resourceAttrs[attr.key] = attr.value?.stringValue || attr.value?.intValue?.toString() || '';
        });

        // Override service name if needed
        if (serviceName.includes('unknown_service:') || serviceName.includes('/node')) {
          resourceAttrs['service.name'] = 'AppSentry Backend';
        }
        
        resourceLog.scopeLogs?.forEach((scopeLog: any) => {
          scopeLog.logRecords?.forEach((logRecord: any) => {
            const timestamp = new Date(parseInt(logRecord.timeUnixNano) / 1000000);
            
            const logAttrs: Record<string, string> = {};
            logRecord.attributes?.forEach((attr: any) => {
              if (attr.value?.stringValue !== undefined) {
                logAttrs[attr.key] = attr.value.stringValue;
              } else if (attr.value?.intValue !== undefined) {
                logAttrs[attr.key] = attr.value.intValue.toString();
              }
            });

            const logRecord_clean = {
              Timestamp: timestamp.toISOString().replace('T', ' ').replace('Z', ''),
              TraceId: logRecord.traceId || '',
              SpanId: logRecord.spanId || '',
              TraceFlags: 0,
              SeverityText: logRecord.severityText || 'INFO',
              SeverityNumber: logRecord.severityNumber || 9,
              ServiceName: resourceAttrs['service.name'] || serviceName,
              Body: logRecord.body?.stringValue || '',
              ResourceSchemaUrl: '',
              ResourceAttributes: resourceAttrs,
              ScopeSchemaUrl: '',
              ScopeName: scopeLog.scope?.name || '',
              ScopeVersion: scopeLog.scope?.version || '',
              ScopeAttributes: {},
              LogAttributes: logAttrs
            };

            logData.push(logRecord_clean);
          });
        });
      });
    }

    // Insert logs into ClickHouse
    if (logData.length > 0) {
      await clickHouseService.insertLogs(logData);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process OTEL logs', { error });
    res.status(500).json({ error: 'Failed to process logs' });
  }
});

// Get traces
router.get('/traces', async (req: Request, res: Response) => {
  try {
    const { timeRange, serviceName, operationName, limit } = req.query;
    
    const traces = await clickHouseService.getTraces({
      timeRange: timeRange as string,
      serviceName: serviceName as string,
      operationName: operationName as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ traces });
  } catch (error) {
    logger.error('Failed to fetch traces', { error });
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// Get trace by ID
router.get('/traces/:traceId', async (req: Request, res: Response) => {
  try {
    const { traceId } = req.params;
    const spans = await clickHouseService.getTraceById(traceId);
    
    res.status(200).json({ spans });
  } catch (error) {
    logger.error('Failed to fetch trace details', { error });
    res.status(500).json({ error: 'Failed to fetch trace details' });
  }
});

// Get metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { timeRange, serviceName, metricName, limit } = req.query;
    
    const metrics = await clickHouseService.getMetrics({
      timeRange: timeRange as string,
      serviceName: serviceName as string,
      metricName: metricName as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ metrics });
  } catch (error) {
    logger.error('Failed to fetch metrics', { error });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get metrics summary
router.get('/metrics/summary', async (req: Request, res: Response) => {
  try {
    const { timeRange } = req.query;
    const summary = await clickHouseService.getMetricsSummary(timeRange as string);
    
    res.status(200).json({ summary });
  } catch (error) {
    logger.error('Failed to fetch metrics summary', { error });
    res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

// Get logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { timeRange, serviceName, severityLevel, searchTerm, limit } = req.query;
    
    const logs = await clickHouseService.getLogs({
      timeRange: timeRange as string,
      serviceName: serviceName as string,
      severityLevel: severityLevel as string,
      searchTerm: searchTerm as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ logs });
  } catch (error) {
    logger.error('Failed to fetch logs', { error });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Health check endpoint for OTEL collector
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'appsentry-otel-ingestion',
  });
});

export default router;