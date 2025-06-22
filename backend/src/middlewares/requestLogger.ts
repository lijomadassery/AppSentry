import morgan from 'morgan';
import { logger } from '../utils/logger';
import { config } from '../config/env';

const stream = {
  write: (message: string) => logger.http(message.trim()),
};

const skip = () => {
  const env = config.env || 'development';
  return env !== 'development';
};

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip },
);