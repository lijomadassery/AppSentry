import { config } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../database/prisma';
import bcrypt from 'bcrypt';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

export class AuthService {
  constructor() {
    // Initialize default users in database
    this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    try {
      // Check if users already exist
      const existingUsersCount = await prisma.user.count();
      if (existingUsersCount > 0) {
        logger.info('Users already exist in database, skipping initialization');
        return;
      }

      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const viewerPasswordHash = await bcrypt.hash('viewer123', 10);
      const lijoPasswordHash = await bcrypt.hash('lijo2025', 10);

      // Create default users
      await prisma.user.createMany({
        data: [
          {
            username: 'admin',
            email: 'admin@appsentry.local',
            displayName: 'Administrator',
            role: 'admin',
            passwordHash: adminPasswordHash,
          },
          {
            username: 'viewer',
            email: 'viewer@appsentry.local',
            displayName: 'Viewer',
            role: 'viewer',
            passwordHash: viewerPasswordHash,
          },
          {
            username: 'lijo',
            email: 'lijo@appsentry.com',
            displayName: 'Lijo Madassery',
            role: 'admin',
            passwordHash: lijoPasswordHash,
          },
        ],
      });

      logger.info('Default users created: admin/admin123, viewer/viewer123, lijo/lijo2025');
    } catch (error) {
      logger.error('Failed to initialize default users:', error);
    }
  }

  public async login(credentials: LoginCredentials): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { username: credentials.username },
      });

      if (!user) {
        logger.warn(`Login attempt with invalid username: ${credentials.username}`);
        return null;
      }

      if (!user.isActive) {
        logger.warn(`Login attempt with inactive user: ${credentials.username}`);
        return null;
      }

      const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isPasswordValid) {
        logger.warn(`Login attempt with invalid password for user: ${credentials.username}`);
        return null;
      }

      // Update last login timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      logger.info(`Successful login for user: ${credentials.username}`);
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
    } catch (error) {
      logger.error('Login error:', error);
      return null;
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
    } catch (error) {
      logger.error('Get user by ID error:', error);
      return null;
    }
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
    } catch (error) {
      logger.error('Get user by username error:', error);
      return null;
    }
  }
}

export const authService = new AuthService();