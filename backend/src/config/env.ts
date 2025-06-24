import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';

// Load .env from parent directory (project root)
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3001),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  CORS_ORIGIN: Joi.string().required(),

  // Database (MySQL)
  DATABASE_URL: Joi.string().required(),

  // ClickHouse (for observability platform)
  CLICKHOUSE_HOST: Joi.string().default('localhost'),
  CLICKHOUSE_PORT: Joi.number().default(8123),
  CLICKHOUSE_DATABASE: Joi.string().default('otel'),
  CLICKHOUSE_USERNAME: Joi.string().default('default'),
  CLICKHOUSE_PASSWORD: Joi.string().allow('').default(''),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().default('http://localhost:3001/api/otel'),
  OTEL_SERVICE_NAME: Joi.string().default('AppSentry Backend'),
  OTEL_SERVICE_VERSION: Joi.string().default('1.0.0'),
  OTEL_DEPLOYMENT_ENVIRONMENT: Joi.string().default('development'),

  // JWT Authentication (required)
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Optional legacy fields (for backwards compatibility)  
  REDIS_URL: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  logLevel: envVars.LOG_LEVEL,
  corsOrigin: envVars.CORS_ORIGIN,
  
  // Database configuration
  database: {
    url: envVars.DATABASE_URL,
  },
  
  // ClickHouse configuration for observability platform
  clickhouse: {
    host: envVars.CLICKHOUSE_HOST,
    port: envVars.CLICKHOUSE_PORT,
    database: envVars.CLICKHOUSE_DATABASE,
    username: envVars.CLICKHOUSE_USERNAME,
    password: envVars.CLICKHOUSE_PASSWORD,
  },
  
  // OpenTelemetry configuration
  otel: {
    endpoint: envVars.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: envVars.OTEL_SERVICE_NAME,
    serviceVersion: envVars.OTEL_SERVICE_VERSION,
    environment: envVars.OTEL_DEPLOYMENT_ENVIRONMENT,
  },
  
  // JWT Authentication
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  // Redis configuration (optional)
  redis: {
    url: envVars.REDIS_URL || 'redis://localhost:6379',
    password: envVars.REDIS_PASSWORD || '',
  },
};