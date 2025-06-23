import winston from 'winston';
import { config } from '../config/env';
import { trace, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = config.env || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Custom format that includes trace context
const traceFormat = winston.format((info) => {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    info.traceId = spanContext.traceId;
    info.spanId = spanContext.spanId;
  }
  return info;
});

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  traceFormat(),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const traceInfo = info.traceId ? ` [trace=${info.traceId.substring(0, 8)} span=${info.spanId.substring(0, 8)}]` : '';
    return `${info.timestamp} ${info.level}: ${info.message}${traceInfo}`;
  }),
);

// Custom log handler that creates proper log entries
const createLogEntry = (info: any) => {
  const activeSpan = trace.getActiveSpan();
  const traceContext = activeSpan ? {
    traceId: activeSpan.spanContext().traceId,
    spanId: activeSpan.spanContext().spanId
  } : {};

  // Strip ANSI color codes from text
  const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*m/g, '');

  // Determine service name based on operation context
  const getServiceName = (info: any): string => {
    const message = stripAnsi(info.message);
    const operation = info.operation || '';
    
    // Categorize logs by service based on operation type
    if (operation === 'clickhouse_insert' || message.includes('ClickHouse')) {
      return 'Database Service';
    } else if (operation === 'platform_metrics' || message.includes('platform')) {
      return 'Platform Service';
    } else if (operation === 'otel_ingestion' || message.includes('OTEL') || message.includes('traces')) {
      return 'Telemetry Service';
    } else if (operation === 'http_request' || message.includes('GET') || message.includes('POST')) {
      return 'API Gateway';
    } else if (operation === 'health_check' || message.includes('health')) {
      return 'Health Service';
    } else {
      return 'AppSentry Backend';
    }
  };

  // Create a log entry that matches ClickHouse logs schema
  const logEntry = {
    Timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    TraceId: traceContext.traceId || '',
    SpanId: traceContext.spanId || '',
    TraceFlags: 0,
    SeverityText: stripAnsi(info.level).toUpperCase(),
    SeverityNumber: getSeverityNumber(stripAnsi(info.level).toLowerCase()),
    ServiceName: getServiceName(info),
    Body: stripAnsi(info.message),
    ResourceSchemaUrl: '',
    ResourceAttributes: {
      'service.name': getServiceName(info),
      'service.version': '1.0.0',
      'deployment.environment': config.env || 'development'
    },
    ScopeSchemaUrl: '',
    ScopeName: 'winston',
    ScopeVersion: '1.0.0',
    ScopeAttributes: {},
    LogAttributes: {
      'log.logger': 'winston',
      'log.level': info.level,
      // Add any additional context from the log info as strings
      ...Object.keys(info).reduce((acc, key) => {
        if (!['message', 'level', 'timestamp', 'traceId', 'spanId'].includes(key)) {
          const value = info[key];
          acc[`log.${key}`] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    }
  };

  return logEntry;
};

const getSeverityNumber = (level: string): number => {
  const severityMap: Record<string, number> = {
    error: 17, // ERROR
    warn: 13,  // WARN  
    info: 9,   // INFO
    debug: 5,  // DEBUG
    http: 9,   // INFO
  };
  return severityMap[level] || 9;
};

// Direct ClickHouse Log Transport
class ClickHouseLogTransport extends winston.Transport {
  constructor(opts: winston.TransportStreamOptions) {
    super(opts);
  }

  async log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Prevent infinite loops - don't log ClickHouse-related errors
    if (info.message && (
      info.message.includes('ClickHouse') || 
      info.message.includes('clickhouse') ||
      info.message.includes('Failed to insert logs') ||
      info.message.includes('LOG STORED IN CLICKHOUSE')
    )) {
      callback();
      return;
    }

    // Send log directly to ClickHouse via HTTP
    try {
      const logEntry = createLogEntry(info);
      
      // Send to ClickHouse via our existing service
      const { clickHouseService } = require('../services/clickhouseService');
      await clickHouseService.insertLogs([logEntry]);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 LOG STORED:', {
          level: info.level,
          message: info.message.substring(0, 50)
        });
      }
    } catch (error) {
      // Don't log ClickHouse errors to prevent infinite loops
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ ClickHouse logging error (not re-logged):', error.message);
      }
    }

    callback();
  }
}

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
  new ClickHouseLogTransport({ level: 'info' }), // Send info and above to ClickHouse
];

export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;