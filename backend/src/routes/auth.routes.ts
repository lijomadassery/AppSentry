import { Router, Request, Response } from 'express';
import session from 'express-session';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { tokenService } from '../services/tokenService';
import { authenticateToken } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { logger } from '../utils/logger';
import { config } from '../config/env';

const router = Router();

// Session middleware for OAuth flow
router.use(
  session({
    secret: config.jwt.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.env === 'production',
      maxAge: 10 * 60 * 1000, // 10 minutes
    },
  }),
);

// Start Azure AD OAuth flow
router.get('/azure/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const authCodeUrl = await authService.getAuthCodeUrl();
    res.redirect(authCodeUrl);
  } catch (error) {
    logger.error('OAuth initiation error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to initiate authentication',
        code: 'AUTH_INITIATION_FAILED',
      },
    });
  }
});

// Azure AD OAuth callback
router.get('/azure/callback', authLimiter, async (req: Request, res: Response) => {
  try {
    const { code, error: authError } = req.query;

    if (authError) {
      logger.error('OAuth callback error:', authError);
      return res.status(400).json({
        error: {
          message: 'Authentication failed',
          code: 'AUTH_CALLBACK_ERROR',
          details: authError,
        },
      });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Authorization code missing',
          code: 'MISSING_AUTH_CODE',
        },
      });
    }

    // Exchange code for tokens
    const authResult = await authService.acquireTokenByCode(code);
    if (!authResult) {
      return res.status(400).json({
        error: {
          message: 'Failed to acquire tokens',
          code: 'TOKEN_ACQUISITION_FAILED',
        },
      });
    }

    // Get user info from Microsoft Graph
    const userInfo = await authService.getUserInfo(authResult.accessToken);
    
    // Find or create user in our database
    const user = await userService.findOrCreateUser(userInfo);

    // Generate our JWT tokens
    const { accessToken, refreshToken } = tokenService.generateTokens({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });

    // Return tokens
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('OAuth callback processing error:', error);
    res.status(500).json({
      error: {
        message: 'Authentication processing failed',
        code: 'AUTH_PROCESSING_FAILED',
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

    const user = await userService.getUserById(req.user.userId);
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
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      lastLogin: user.lastLogin,
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