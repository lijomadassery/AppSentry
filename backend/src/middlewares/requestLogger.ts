import morgan from 'morgan';
import { logger } from '../utils/logger';
import { config } from '../config/env';

const stream = {
  write: (message: string) => {
    // Parse the morgan message to extract details
    const parts = message.trim().split(' ');
    const method = parts[0];
    const url = parts[1];
    const status = parts[2];
    const responseTime = parts[parts.length - 2]; // second to last is response time
    
    logger.info(`${method} ${url}`, {
      operation: 'http_request',
      method,
      url,
      status_code: parseInt(status),
      response_time_ms: parseFloat(responseTime),
      source: 'request_middleware'
    });
  },
};

const skip = () => {
  const env = config.env || 'development';
  return env !== 'development';
};

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip },
);