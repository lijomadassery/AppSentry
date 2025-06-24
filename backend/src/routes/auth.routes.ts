import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import { authenticateToken } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { validate } from '../middlewares/validation';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).max(100).required(),
});

// Login with username/password
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Authenticate user
    const user = await authService.login({ username, password });
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = tokenService.generateTokens({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });

    logger.info(`User ${user.username} logged in successfully`);

    // Return tokens and user info
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      },
    });
  }
});

// Refresh access token
router.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          message: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN',
        },
      });
    }

    const tokens = await tokenService.refreshTokens(refreshToken);
    if (!tokens) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        },
      });
    }

    res.json(tokens);
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: {
        message: 'Token refresh failed',
        code: 'TOKEN_REFRESH_FAILED',
      },
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await tokenService.revokeToken(req.user.tokenId, req.user.userId);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: {
        message: 'Logout failed',
        code: 'LOGOUT_FAILED',
      },
    });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
    }

    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get user information',
        code: 'USER_INFO_FAILED',
      },
    });
  }
});

export default router;