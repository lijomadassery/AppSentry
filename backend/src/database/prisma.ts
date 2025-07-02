import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class Database {
  private static instance: Database;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: config.env === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });

  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connection established successfully');
    } catch (error) {
      logger.error('Unable to connect to the database:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const database = Database.getInstance();
export const prisma = database.getPrisma();