import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { trace } from '@opentelemetry/api';

const OTEL_ENDPOINT = process.env.REACT_APP_OTEL_ENDPOINT || 'http://192.168.49.2:30318';

export const initializeOTel = (): void => {
  const resource = resourceFromAttributes({
    'service.name': 'appsentry-frontend',
    'service.version': '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  });

  const exporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
    headers: {},
  });

  const processor = new BatchSpanProcessor(exporter, {
    maxQueueSize: 100,
    scheduledDelayMillis: 500,
    exportTimeoutMillis: 30000,
    maxExportBatchSize: 10,
  });

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [processor],
  });

  provider.register();

  // Register instrumentations
  const fetchInstrumentation = new FetchInstrumentation({
    // Don't trace health check or metrics endpoints
    ignoreUrls: [
      /\/health$/,
      /\/metrics$/,
      // Also ignore OTEL endpoints to prevent infinite loops
      /\/v1\/(traces|metrics|logs)$/,
    ],
    propagateTraceHeaderCorsUrls: [
      /^http:\/\/localhost:3001\/.*$/,
      new RegExp(`^${OTEL_ENDPOINT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*$`),
    ],
    applyCustomAttributesOnSpan: (span, request, result) => {
      // Add custom attributes for API calls
      const url = typeof request === 'string' ? request : (request as Request).url;
      if (url && url.includes('/api/')) {
        span.setAttributes({
          'http.api_call': true,
          'appsentry.component': 'frontend',
        });
      }
    },
  });

  const xhrInstrumentation = new XMLHttpRequestInstrumentation({
    ignoreUrls: [
      /\/health$/,
      /\/metrics$/,
      /\/v1\/(traces|metrics|logs)$/,
    ],
    propagateTraceHeaderCorsUrls: [
      /^http:\/\/localhost:3001\/.*$/,
    ],
  });

  // Initialize instrumentations
  fetchInstrumentation.setTracerProvider(provider);
  xhrInstrumentation.setTracerProvider(provider);

  // Register the global tracer provider
  trace.setGlobalTracerProvider(provider);

  console.log('OpenTelemetry initialized for frontend', {
    endpoint: OTEL_ENDPOINT,
    serviceName: 'appsentry-frontend',
  });
};

// Get tracer for manual instrumentation
export const getTracer = (name: string = 'appsentry-frontend') => {
  return trace.getTracer(name, '1.0.0');
};

// Utility function to create spans for React components
export const withSpan = <T extends any[], R>(
  spanName: string,
  fn: (...args: T) => R,
  attributes?: Record<string, string | number | boolean>
) => {
  return (...args: T): R => {
    const tracer = getTracer();
    return tracer.startActiveSpan(spanName, (span) => {
      if (attributes) {
        span.setAttributes(attributes);
      }
      try {
        const result = fn(...args);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  };
};