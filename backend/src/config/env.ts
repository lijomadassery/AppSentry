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

  // JWT Authentication (required)
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Optional legacy fields (for backwards compatibility)  
  REDIS_URL: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  
  // Testing configuration
  PLAYWRIGHT_HEADLESS: Joi.boolean().optional(),
  PARALLEL_TEST_LIMIT: Joi.number().optional(),
  TEST_TIMEOUT: Joi.number().optional(),
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
  
  // Testing configuration
  testing: {
    playwrightHeadless: envVars.PLAYWRIGHT_HEADLESS ?? true,
    parallelTestLimit: envVars.PARALLEL_TEST_LIMIT || 5,
    testTimeout: envVars.TEST_TIMEOUT || 30000,
  },
};