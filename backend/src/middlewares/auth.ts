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
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          message: 'Access token required',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const payload = tokenService.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({
        error: {
          message: 'Invalid or expired token',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    // Verify user still exists and is active
    const user = await userService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        error: {
          message: 'User account not found or inactive',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    req.user = {
      ...payload,
      role: user.role, // Use current role from database
    };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
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
      res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN',
        },
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(UserRole.admin);
export const requireTeamLead = requireRole([UserRole.admin, UserRole.team_lead]);
export const requireDeveloper = requireRole([UserRole.admin, UserRole.team_lead, UserRole.developer]);
export const requireViewer = requireRole([UserRole.admin, UserRole.team_lead, UserRole.developer, UserRole.viewer]);

export const optionalAuth = async (
  req: Request,
  _res: Response,
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