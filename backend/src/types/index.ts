// Export all Prisma types
export type {
  User,
  Application,
  Team,
  TeamMembership,
  HealthCheck,
} from '@prisma/client';

// Export enums from Prisma
export {
  UserRole,
  Environment,
  HealthStatus,
} from '@prisma/client';

// Custom types for API responses
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp?: string;
}

// User with relations
export interface UserWithRelations extends User {
  teams?: TeamMembership[];
  createdApplications?: Application[];
  modifiedApplications?: Application[];
}

// Application with relations
export interface ApplicationWithRelations extends Application {
  creator?: User;
  lastModifier?: User;
  team?: Team;
  healthChecks?: HealthCheck[];
}

// Application creation input
export interface CreateApplicationInput {
  name: string;
  displayName: string;
  description?: string;
  environment: Environment;
  category: string;
  healthUrl: string;
  loginUrl?: string;
  config: any;
  ownerTeam?: string;
  ownerEmail?: string;
  tags?: string[];
}

// Application update input
export interface UpdateApplicationInput {
  name?: string;
  displayName?: string;
  description?: string;
  environment?: Environment;
  category?: string;
  healthUrl?: string;
  loginUrl?: string;
  config?: any;
  ownerTeam?: string;
  ownerEmail?: string;
  tags?: string[];
  isActive?: boolean;
}