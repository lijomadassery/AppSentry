import Redis from 'ioredis';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null;

  private constructor() {
    if (!REDIS_ENABLED) {
      logger.info('Redis disabled - running without Redis');
      this.client = null;
      return;
    }

    this.client = new Redis(config.redis.url, {
      password: config.redis.password || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      logger.info('Redis client connection closed');
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public getClient(): Redis | null {
    return this.client;
  }

  public async setWithExpiry(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  public async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  public async delete(key: string): Promise<number> {
    if (!this.client) return 0;
    return await this.client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  public async close(): Promise<void> {
    if (!this.client) return;
    await this.client.quit();
  }
}

export const redisClient = RedisClient.getInstance().getClient();