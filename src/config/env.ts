import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  CORS_ORIGIN: Joi.string().required(),

  // Database
  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_USERNAME: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_PASSWORD: Joi.string().allow(''),

  // Azure AD
  AZURE_AD_TENANT_ID: Joi.string().required(),
  AZURE_AD_CLIENT_ID: Joi.string().required(),
  AZURE_AD_CLIENT_SECRET: Joi.string().required(),
  AZURE_AD_REDIRECT_URI: Joi.string().uri().required(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Azure Storage
  AZURE_STORAGE_ACCOUNT: Joi.string().required(),
  AZURE_STORAGE_KEY: Joi.string().required(),
  AZURE_STORAGE_CONTAINER: Joi.string().default('screenshots'),

  // Testing
  HEALTH_CHECK_PASSWORD: Joi.string().required(),
  PLAYWRIGHT_HEADLESS: Joi.boolean().default(true),
  TEST_TIMEOUT: Joi.number().default(30000),
  PARALLEL_TEST_LIMIT: Joi.number().default(5),

  // Notifications
  TEAMS_WEBHOOK_URL: Joi.string().uri().allow(''),
  SENDGRID_API_KEY: Joi.string().allow(''),
  EMAIL_FROM: Joi.string().email().allow(''),
  EMAIL_RECIPIENTS: Joi.string().allow(''),

  // Features
  ENABLE_REGISTRATION: Joi.boolean().default(false),
  ENABLE_PASSWORD_RESET: Joi.boolean().default(false),
  ENABLE_BULK_OPERATIONS: Joi.boolean().default(true),
  ENABLE_SCHEDULED_REPORTS: Joi.boolean().default(true),
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
  
  database: {
    host: envVars.MYSQL_HOST,
    port: envVars.MYSQL_PORT,
    database: envVars.MYSQL_DATABASE,
    username: envVars.MYSQL_USERNAME,
    password: envVars.MYSQL_PASSWORD,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
  },
  
  azureAd: {
    tenantId: envVars.AZURE_AD_TENANT_ID,
    clientId: envVars.AZURE_AD_CLIENT_ID,
    clientSecret: envVars.AZURE_AD_CLIENT_SECRET,
    redirectUri: envVars.AZURE_AD_REDIRECT_URI,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  azureStorage: {
    account: envVars.AZURE_STORAGE_ACCOUNT,
    key: envVars.AZURE_STORAGE_KEY,
    container: envVars.AZURE_STORAGE_CONTAINER,
  },
  
  testing: {
    healthCheckPassword: envVars.HEALTH_CHECK_PASSWORD,
    playwrightHeadless: envVars.PLAYWRIGHT_HEADLESS,
    testTimeout: envVars.TEST_TIMEOUT,
    parallelTestLimit: envVars.PARALLEL_TEST_LIMIT,
  },
  
  notifications: {
    teamsWebhookUrl: envVars.TEAMS_WEBHOOK_URL,
    sendgridApiKey: envVars.SENDGRID_API_KEY,
    emailFrom: envVars.EMAIL_FROM,
    emailRecipients: envVars.EMAIL_RECIPIENTS,
  },
  
  features: {
    enableRegistration: envVars.ENABLE_REGISTRATION,
    enablePasswordReset: envVars.ENABLE_PASSWORD_RESET,
    enableBulkOperations: envVars.ENABLE_BULK_OPERATIONS,
    enableScheduledReports: envVars.ENABLE_SCHEDULED_REPORTS,
  },
};