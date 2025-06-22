import { prisma } from '../database/prisma';
import { User, UserRole } from '../types';
import { logger } from '../utils/logger';

export class UserService {
  public async findOrCreateUser(azureUserData: {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
    givenName?: string;
    surname?: string;
  }): Promise<User> {
    try {
      const email = azureUserData.mail || azureUserData.userPrincipalName || '';
      
      const user = await prisma.user.upsert({
        where: { id: azureUserData.id },
        update: {
          lastLogin: new Date(),
          displayName: azureUserData.displayName || undefined,
          firstName: azureUserData.givenName || undefined,
          lastName: azureUserData.surname || undefined,
        },
        create: {
          id: azureUserData.id,
          email,
          displayName: azureUserData.displayName || email,
          firstName: azureUserData.givenName,
          lastName: azureUserData.surname,
          role: UserRole.viewer, // Default role
          isActive: true,
          lastLogin: new Date(),
        },
      });

      if (!user.lastLogin || user.lastLogin.getTime() === new Date().getTime()) {
        logger.info(`New user created: ${email}`);
      }

      return user;
    } catch (error) {
      logger.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  public async getUserById(id: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      return null;
    }
  }

  public async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { role },
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      return null;
    }
  }

  public async deactivateUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      return true;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      return false;
    }
  }

  public async getAllUsers(page = 1, limit = 20): Promise<{ users: User[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count(),
      ]);

      return { users, total };
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }
}

export const userService = new UserService();