import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import * as traceSDK from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor, SimpleSpanProcessor, BasicTracerProvider, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logger } from './utils/logger';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// Custom span processor that writes directly to ClickHouse to avoid circular dependency
class ClickHouseSpanProcessor implements SpanProcessor {
  private clickHouseService: any;

  constructor() {
    // Import ClickHouse service lazily to avoid circular dependency
    setTimeout(() => {
      const { clickHouseService } = require('./services/clickhouseService');
      this.clickHouseService = clickHouseService;
    }, 1000);
  }

  onStart(span: ReadableSpan): void {
    // Nothing to do on start
  }

  onEnd(span: ReadableSpan): void {
    if (!this.clickHouseService) {
      logger.warn('ClickHouse service not ready, skipping span:', span.name);
      return; // ClickHouse service not ready yet
    }

    logger.info('Processing span for ClickHouse:', { 
      name: span.name, 
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId 
    });

    try {
      // Convert span to ClickHouse format and insert
      const traceRecord = {
        Timestamp: new Date(span.startTime[0] * 1000 + span.startTime[1] / 1000000).toISOString().replace('T', ' ').replace('Z', ''),
        TraceId: span.spanContext().traceId,
        SpanId: span.spanContext().spanId,
        ParentSpanId: span.parentSpanId || '',
        TraceState: '',
        SpanName: span.name,
        SpanKind: span.kind?.toString() || '1',
        ServiceName: span.resource.attributes['service.name'] || 'AppSentry Backend',
        ResourceAttributes: span.resource.attributes,
        ScopeName: span.instrumentationLibrary?.name || '',
        ScopeVersion: span.instrumentationLibrary?.version || '',
        SpanAttributes: span.attributes,
        Duration: (span.endTime[0] - span.startTime[0]) * 1000000000 + (span.endTime[1] - span.startTime[1]),
        StatusCode: span.status?.code?.toString() || '0',
        StatusMessage: span.status?.message || '',
        'Events.Timestamp': [],
        'Events.Name': [],
        'Events.Attributes': [],
        'Links.TraceId': [],
        'Links.SpanId': [],
        'Links.TraceState': [],
        'Links.Attributes': []
      };

      // Insert asynchronously to avoid blocking
      this.clickHouseService.insertTraces([traceRecord]).catch((error: any) => {
        logger.error('Failed to insert span to ClickHouse:', error);
      });
      
    } catch (error) {
      logger.error('Error processing span for ClickHouse:', error);
    }
  }

  async forceFlush(): Promise<void> {
    // Nothing to flush
  }

  async shutdown(): Promise<void> {
    // Nothing to shutdown
  }
}

export const initializeOTel = (): any => {
  try {
    // Create resource information with Kubernetes metadata if available
    const resourceAttributes: Record<string, string> = {
      [SemanticResourceAttributes.SERVICE_NAME]: 'AppSentry Backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    };

    // Add Kubernetes metadata if running in K8s
    if (process.env.K8S_POD_NAME) {
      resourceAttributes['k8s.pod.name'] = process.env.K8S_POD_NAME;
    }
    if (process.env.K8S_POD_NAMESPACE) {
      resourceAttributes['k8s.namespace.name'] = process.env.K8S_POD_NAMESPACE;
    }
    if (process.env.K8S_NODE_NAME) {
      resourceAttributes['k8s.node.name'] = process.env.K8S_NODE_NAME;
    }
    if (process.env.K8S_CONTAINER_NAME) {
      resourceAttributes['k8s.container.name'] = process.env.K8S_CONTAINER_NAME;
    }
    if (process.env.K8S_POD_UID) {
      resourceAttributes['k8s.pod.uid'] = process.env.K8S_POD_UID;
    }
    if (process.env.K8S_CLUSTER_NAME) {
      resourceAttributes['k8s.cluster.name'] = process.env.K8S_CLUSTER_NAME;
    }

    const resource = resourceFromAttributes(resourceAttributes);

    // Create OTLP trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      headers: {},
    });
    
    // Create span processor
    const spanProcessor = new BatchSpanProcessor(traceExporter);
    
    // Use NodeTracerProvider with resource information
    const provider = new traceSDK.NodeTracerProvider({
      resource: resource,
      spanProcessors: [spanProcessor]
    });

    // Register the provider globally
    provider.register();
    
    // Register instrumentations to capture real application telemetry
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check endpoints to reduce noise
            return req.url?.includes('/health') || false;
          },
        }),
        new ExpressInstrumentation({
          ignoreLayers: [
            // Ignore some Express middleware layers to reduce noise
            (layer) => layer.name === 'cors',
          ],
        }),
      ],
    });
    
    // Set up metrics export
    const metricExporter = new OTLPMetricExporter({
      url: `${OTEL_ENDPOINT}/v1/metrics`,
      headers: {},
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 5000, // Export every 5 seconds
    });

    const meterProvider = new MeterProvider({
      resource: resource,
      readers: [metricReader],
    });

    // Register the meter provider globally
    metrics.setGlobalMeterProvider(meterProvider);
    
    // Set up log export
    const logExporter = new OTLPLogExporter({
      url: `${OTEL_ENDPOINT}/v1/logs`,
      headers: {},
    });

    const logProcessor = new BatchLogRecordProcessor(logExporter);
    
    const loggerProvider = new LoggerProvider({
      resource: resource,
      logRecordProcessors: [logProcessor],
    });

    // Register the logger provider globally
    logs.setGlobalLoggerProvider(loggerProvider);
    
    logger.info('OpenTelemetry initialized successfully', {
      endpoint: OTEL_ENDPOINT,
      serviceName: 'appsentry-backend',
    });

    return { traceProvider: provider, meterProvider, loggerProvider };
  } catch (error) {
    console.error('OTEL Initialization Error:', error);
    logger.error('Failed to initialize OpenTelemetry', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined 
    });
    // Return a basic provider that won't crash the app
    const fallbackProvider = new traceSDK.NodeTracerProvider();
    fallbackProvider.register();
    return fallbackProvider;
  }
};

export const shutdownOTel = async (provider: any): Promise<void> => {
  try {
    await provider.shutdown();
    logger.info('OpenTelemetry shutdown complete');
  } catch (error) {
    logger.error('Error during OpenTelemetry shutdown', { error });
  }
};