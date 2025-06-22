import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    message: err.message,
    stack: err.stack,
    code: err.code,
    details: err.details,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  res.status(statusCode).json({
    error: {
      message: config.env === 'production' ? 'An error occurred' : message,
      code: err.code,
      ...(config.env !== 'production' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.url,
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    timestamp: new Date().toISOString(),
    path: req.url,
  });
};

import { config } from '../config/env';