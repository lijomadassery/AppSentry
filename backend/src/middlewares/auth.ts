import { Request, Response, NextFunction } from 'express';
import { tokenService, TokenPayload } from '../services/tokenService';
import { userService } from '../services/userService';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'UNAUTHORIZED',
        },
      });
    }

    const payload = tokenService.verifyAccessToken(token);
    if (!payload) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired token',
          code: 'UNAUTHORIZED',
        },
      });
    }

    // Verify user still exists and is active
    const user = await userService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          message: 'User account not found or inactive',
          code: 'UNAUTHORIZED',
        },
      });
    }

    req.user = {
      ...payload,
      role: user.role, // Use current role from database
    };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: {
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
      },
    });
  }
};

export const requireRole = (roles: UserRole | UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
        },
      });
    }

    next();
  };
};

export const requireAdmin = requireRole(UserRole.admin);
export const requireEditor = requireRole([UserRole.admin, UserRole.editor]);
export const requireViewer = requireRole([UserRole.admin, UserRole.editor, UserRole.viewer]);

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = tokenService.verifyAccessToken(token);
      if (payload) {
        const user = await userService.getUserById(payload.userId);
        if (user && user.isActive) {
          req.user = {
            ...payload,
            role: user.role,
          };
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
};