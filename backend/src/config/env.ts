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

  // Optional legacy fields (for backwards compatibility)
  MYSQL_HOST: Joi.string().optional(),
  MYSQL_PORT: Joi.number().optional(),
  MYSQL_DATABASE: Joi.string().optional(),
  MYSQL_USERNAME: Joi.string().optional(),
  MYSQL_PASSWORD: Joi.string().optional(),
  REDIS_URL: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  AZURE_AD_TENANT_ID: Joi.string().optional(),
  AZURE_AD_CLIENT_ID: Joi.string().optional(),
  AZURE_AD_CLIENT_SECRET: Joi.string().optional(),
  AZURE_AD_REDIRECT_URI: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
  JWT_EXPIRES_IN: Joi.string().optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().optional(),
  AZURE_STORAGE_ACCOUNT: Joi.string().allow('').optional(),
  AZURE_STORAGE_KEY: Joi.string().allow('').optional(),
  AZURE_STORAGE_CONTAINER: Joi.string().allow('').optional(),
  HEALTH_CHECK_PASSWORD: Joi.string().optional(),
  PLAYWRIGHT_HEADLESS: Joi.boolean().optional(),
  TEST_TIMEOUT: Joi.number().optional(),
  PARALLEL_TEST_LIMIT: Joi.number().optional(),
  TEAMS_WEBHOOK_URL: Joi.string().allow('').optional(),
  SENDGRID_API_KEY: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().allow('').optional(),
  EMAIL_RECIPIENTS: Joi.string().allow('').optional(),
  ENABLE_REGISTRATION: Joi.boolean().optional(),
  ENABLE_PASSWORD_RESET: Joi.boolean().optional(),
  ENABLE_BULK_OPERATIONS: Joi.boolean().optional(),
  ENABLE_SCHEDULED_REPORTS: Joi.boolean().optional(),
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
  
  // Legacy configurations (optional, for backwards compatibility)
  database: {
    host: envVars.MYSQL_HOST || 'localhost',
    port: envVars.MYSQL_PORT || 3306,
    database: envVars.MYSQL_DATABASE || 'appsentry_dev',
    username: envVars.MYSQL_USERNAME || 'root',
    password: envVars.MYSQL_PASSWORD || 'password',
  },
  
  redis: {
    url: envVars.REDIS_URL || 'redis://localhost:6379',
    password: envVars.REDIS_PASSWORD || '',
  },
  
  azureAd: {
    tenantId: envVars.AZURE_AD_TENANT_ID || '',
    clientId: envVars.AZURE_AD_CLIENT_ID || '',
    clientSecret: envVars.AZURE_AD_CLIENT_SECRET || '',
    redirectUri: envVars.AZURE_AD_REDIRECT_URI || '',
  },
  
  jwt: {
    secret: envVars.JWT_SECRET || 'development-secret',
    expiresIn: envVars.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  azureStorage: {
    account: envVars.AZURE_STORAGE_ACCOUNT || '',
    key: envVars.AZURE_STORAGE_KEY || '',
    container: envVars.AZURE_STORAGE_CONTAINER || 'screenshots',
  },
  
  testing: {
    healthCheckPassword: envVars.HEALTH_CHECK_PASSWORD || 'test-password',
    playwrightHeadless: envVars.PLAYWRIGHT_HEADLESS || true,
    testTimeout: envVars.TEST_TIMEOUT || 30000,
    parallelTestLimit: envVars.PARALLEL_TEST_LIMIT || 5,
  },
  
  notifications: {
    teamsWebhookUrl: envVars.TEAMS_WEBHOOK_URL || '',
    sendgridApiKey: envVars.SENDGRID_API_KEY || '',
    emailFrom: envVars.EMAIL_FROM || '',
    emailRecipients: envVars.EMAIL_RECIPIENTS || '',
  },
  
  features: {
    enableRegistration: envVars.ENABLE_REGISTRATION || false,
    enablePasswordReset: envVars.ENABLE_PASSWORD_RESET || false,
    enableBulkOperations: envVars.ENABLE_BULK_OPERATIONS || true,
    enableScheduledReports: envVars.ENABLE_SCHEDULED_REPORTS || true,
  },
};