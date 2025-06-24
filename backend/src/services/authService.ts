import { config } from '../config/env';
import { logger } from '../utils/logger';
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
  // Simple in-memory user store for demo - in production, use a database
  private users: Map<string, { id: string; username: string; email: string; displayName: string; role: string; passwordHash: string }> = new Map();

  constructor() {
    // Create default admin user
    this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const viewerPasswordHash = await bcrypt.hash('viewer123', 10);
    const lijoPasswordHash = await bcrypt.hash('lijo2025', 10);

    this.users.set('admin', {
      id: 'admin-001',
      username: 'admin',
      email: 'admin@appsentry.local',
      displayName: 'Administrator',
      role: 'admin',
      passwordHash: adminPasswordHash,
    });

    this.users.set('viewer', {
      id: 'viewer-001',
      username: 'viewer',
      email: 'viewer@appsentry.local',
      displayName: 'Viewer',
      role: 'viewer',
      passwordHash: viewerPasswordHash,
    });

    this.users.set('lijo', {
      id: 'lijo-001',
      username: 'lijo',
      email: 'lijo@appsentry.com',
      displayName: 'Lijo Madassery',
      role: 'admin',
      passwordHash: lijoPasswordHash,
    });

    logger.info('Default users initialized: admin/admin123, viewer/viewer123, lijo/lijo2025');
  }

  public async login(credentials: LoginCredentials): Promise<User | null> {
    const user = this.users.get(credentials.username);
    if (!user) {
      logger.warn(`Login attempt with invalid username: ${credentials.username}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn(`Login attempt with invalid password for user: ${credentials.username}`);
      return null;
    }

    logger.info(`Successful login for user: ${credentials.username}`);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  public async getUserById(userId: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    const user = this.users.get(username);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}

export const authService = new AuthService();