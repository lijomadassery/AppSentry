import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import * as traceSDK from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor, SimpleSpanProcessor, BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { trace, metrics } from '@opentelemetry/api';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { logger } from './utils/logger';

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

export const initializeOTel = (): any => {
  try {
    // Create OTLP trace exporter with debugging
    const traceExporter = new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      headers: {},
    });
    
    // Create span processor first
    const spanProcessor = new SimpleSpanProcessor(traceExporter);
    
    // Use NodeTracerProvider with basic configuration (skip Resource for now)
    const provider = new traceSDK.NodeTracerProvider({
      spanProcessors: [spanProcessor]
    });

    // Register the provider globally
    provider.register();
    
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
      readers: [metricReader],
    });

    // Register the meter provider globally
    metrics.setGlobalMeterProvider(meterProvider);
    
    logger.info('OpenTelemetry initialized successfully', {
      endpoint: OTEL_ENDPOINT,
      serviceName: 'appsentry-backend',
    });

    return { traceProvider: provider, meterProvider };
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