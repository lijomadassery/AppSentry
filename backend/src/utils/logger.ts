import winston from 'winston';
import { config } from '../config/env';

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

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

const winstonLogger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Enhanced logger that adds context
export const logger = {
  error: (message: string, meta?: any) => {
    winstonLogger.error(message, meta);
  },
  warn: (message: string, meta?: any) => {
    winstonLogger.warn(message, meta);
  },
  info: (message: string, meta?: any) => {
    winstonLogger.info(message, meta);
  },
  http: (message: string, meta?: any) => {
    winstonLogger.http(message, meta);
  },
  debug: (message: string, meta?: any) => {
    winstonLogger.debug(message, meta);
  },
};