import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { redisClient } from '../database/redis';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

export interface TokenPayload {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  tokenId: string;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  createdAt: Date;
  expiresAt: Date;
}

export class TokenService {
  private static readonly ACCESS_TOKEN_PREFIX = 'access_token:';
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private static readonly USER_TOKENS_PREFIX = 'user_tokens:';

  public generateTokens(user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
  }): { accessToken: string; refreshToken: string; tokenId: string } {
    const tokenId = crypto.randomUUID();
    
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tokenId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: 'appsentry-api',
      audience: 'appsentry-client',
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');

    this.storeRefreshToken(refreshToken, {
      userId: user.id,
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.parseTimeToMs(config.jwt.refreshExpiresIn)),
    });

    this.addTokenToUserTokens(user.id, tokenId);

    return { accessToken, refreshToken, tokenId };
  }

  public verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'appsentry-api',
        audience: 'appsentry-client',
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  public async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const refreshTokenData = await this.getRefreshToken(refreshToken);
      
      if (!refreshTokenData) {
        logger.warn('Refresh token not found');
        return null;
      }

      if (new Date() > refreshTokenData.expiresAt) {
        logger.warn('Refresh token expired');
        await this.revokeRefreshToken(refreshToken);
        return null;
      }

      const newRefreshToken = crypto.randomBytes(64).toString('hex');
      
      await this.revokeRefreshToken(refreshToken);
      
      await this.storeRefreshToken(newRefreshToken, {
        ...refreshTokenData,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTimeToMs(config.jwt.refreshExpiresIn)),
      });

      const payload: TokenPayload = {
        userId: refreshTokenData.userId,
        email: '', 
        displayName: '', 
        role: UserRole.viewer, 
        tokenId: refreshTokenData.tokenId,
      };

      const newAccessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        issuer: 'appsentry-api',
        audience: 'appsentry-client',
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      return null;
    }
  }

  public async revokeToken(tokenId: string, userId: string): Promise<void> {
    try {
      await redisClient.del(`${TokenService.ACCESS_TOKEN_PREFIX}${tokenId}`);
      
      const userTokensKey = `${TokenService.USER_TOKENS_PREFIX}${userId}`;
      await redisClient.srem(userTokensKey, tokenId);
      
      const refreshTokenKeys = await redisClient.keys(`${TokenService.REFRESH_TOKEN_PREFIX}*`);
      for (const key of refreshTokenKeys) {
        const data = await redisClient.get(key);
        if (data) {
          const tokenData = JSON.parse(data) as RefreshTokenData;
          if (tokenData.tokenId === tokenId) {
            await redisClient.del(key);
            break;
          }
        }
      }
    } catch (error) {
      logger.error('Token revocation failed:', error);
    }
  }

  public async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const userTokensKey = `${TokenService.USER_TOKENS_PREFIX}${userId}`;
      const tokenIds = await redisClient.smembers(userTokensKey);
      
      for (const tokenId of tokenIds) {
        await this.revokeToken(tokenId, userId);
      }
      
      await redisClient.del(userTokensKey);
    } catch (error) {
      logger.error('Failed to revoke all user tokens:', error);
    }
  }

  private async storeRefreshToken(
    refreshToken: string,
    tokenData: RefreshTokenData,
  ): Promise<void> {
    const key = `${TokenService.REFRESH_TOKEN_PREFIX}${refreshToken}`;
    const ttlSeconds = Math.floor((tokenData.expiresAt.getTime() - Date.now()) / 1000);
    
    await redisClient.setex(key, ttlSeconds, JSON.stringify(tokenData));
  }

  private async getRefreshToken(refreshToken: string): Promise<RefreshTokenData | null> {
    const key = `${TokenService.REFRESH_TOKEN_PREFIX}${refreshToken}`;
    const data = await redisClient.get(key);
    
    if (!data) return null;
    
    const tokenData = JSON.parse(data) as RefreshTokenData;
    tokenData.createdAt = new Date(tokenData.createdAt);
    tokenData.expiresAt = new Date(tokenData.expiresAt);
    
    return tokenData;
  }

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    const key = `${TokenService.REFRESH_TOKEN_PREFIX}${refreshToken}`;
    await redisClient.del(key);
  }

  private async addTokenToUserTokens(userId: string, tokenId: string): Promise<void> {
    const key = `${TokenService.USER_TOKENS_PREFIX}${userId}`;
    await redisClient.sadd(key, tokenId);
  }

  private parseTimeToMs(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }
}

export const tokenService = new TokenService();