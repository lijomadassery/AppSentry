import { clickHouseService } from './clickhouseService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface Application {
  id?: string;
  name: string;
  team: string;
  namespace: string;
  environment?: 'development' | 'staging' | 'production';
  health_check_url: string;
  health_check_interval?: number;
  status?: 'unknown' | 'healthy' | 'degraded' | 'down';
  last_check_time?: Date;
  created_at?: Date;
  updated_at?: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  sla_target?: number;
  active?: boolean;
}

interface HealthCheck {
  id?: string;
  application_id: string;
  check_time?: Date;
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms: number;
  status_code?: number;
  error_message?: string;
  details?: Record<string, any>;
  check_type?: 'http' | 'tcp' | 'grpc' | 'custom';
}

class ApplicationRegistryService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Execute the schema creation SQL
      const schemaSQL = `
        CREATE DATABASE IF NOT EXISTS appsentry;
        
        CREATE TABLE IF NOT EXISTS appsentry.applications
        (
            id String,
            name String,
            team String,
            namespace String,
            environment Enum8('development' = 1, 'staging' = 2, 'production' = 3) DEFAULT 'development',
            health_check_url String,
            health_check_interval UInt32 DEFAULT 30,
            status Enum8('unknown' = 0, 'healthy' = 1, 'degraded' = 2, 'down' = 3) DEFAULT 'unknown',
            last_check_time DateTime64(3, 'UTC'),
            created_at DateTime64(3, 'UTC') DEFAULT now64(3),
            updated_at DateTime64(3, 'UTC') DEFAULT now64(3),
            metadata String,
            tags Array(String),
            sla_target Float32 DEFAULT 99.9,
            active Bool DEFAULT true
        ) ENGINE = MergeTree()
        ORDER BY (team, namespace, name)
        PARTITION BY toYYYYMM(created_at);

        CREATE TABLE IF NOT EXISTS appsentry.health_checks
        (
            id String DEFAULT generateUUIDv4(),
            application_id String,
            check_time DateTime64(3, 'UTC') DEFAULT now64(3),
            status Enum8('healthy' = 1, 'degraded' = 2, 'down' = 3),
            response_time_ms UInt32,
            status_code UInt16,
            error_message String,
            details String,
            check_type Enum8('http' = 1, 'tcp' = 2, 'grpc' = 3, 'custom' = 4) DEFAULT 'http'
        ) ENGINE = MergeTree()
        ORDER BY (application_id, check_time)
        PARTITION BY toYYYYMMDD(check_time)
        TTL toDateTime(check_time) + INTERVAL 30 DAY;
      `;

      // Execute each statement separately
      const statements = schemaSQL.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await clickHouseService.client.exec({
            query: statement.trim()
          });
        }
      }

      this.initialized = true;
      logger.info('Application registry tables initialized');
    } catch (error) {
      logger.error('Failed to initialize application registry tables', { error });
      throw error;
    }
  }

  // Application CRUD operations
  async createApplication(app: Application): Promise<Application> {
    await this.initialize();

    const id = app.id || uuidv4();
    const now = new Date();

    try {
      await clickHouseService.client.insert({
        table: 'appsentry.applications',
        values: [{
          id,
          name: app.name,
          team: app.team,
          namespace: app.namespace,
          environment: app.environment || 'development',
          health_check_url: app.health_check_url,
          health_check_interval: app.health_check_interval || 30,
          status: app.status || 'unknown',
          last_check_time: app.last_check_time || null,
          created_at: now,
          updated_at: now,
          metadata: app.metadata ? JSON.stringify(app.metadata) : '',
          tags: app.tags || [],
          sla_target: app.sla_target || 99.9,
          active: app.active !== false
        }],
        format: 'JSONEachRow'
      });

      return { ...app, id, created_at: now, updated_at: now };
    } catch (error) {
      logger.error('Failed to create application', { error, app });
      throw error;
    }
  }

  async getApplications(filters?: {
    team?: string;
    namespace?: string;
    environment?: string;
    status?: string;
    active?: boolean;
  }): Promise<Application[]> {
    await this.initialize();

    let whereConditions: string[] = [];
    
    if (filters?.team) {
      whereConditions.push(`team = '${filters.team}'`);
    }
    if (filters?.namespace) {
      whereConditions.push(`namespace = '${filters.namespace}'`);
    }
    if (filters?.environment) {
      whereConditions.push(`environment = '${filters.environment}'`);
    }
    if (filters?.status) {
      whereConditions.push(`status = '${filters.status}'`);
    }
    if (filters?.active !== undefined) {
      whereConditions.push(`active = ${filters.active ? 1 : 0}`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    try {
      const query = `
        SELECT 
          id,
          name,
          team,
          namespace,
          environment,
          health_check_url,
          health_check_interval,
          status,
          last_check_time,
          created_at,
          updated_at,
          metadata,
          tags,
          sla_target,
          active
        FROM appsentry.applications
        ${whereClause}
        ORDER BY team, namespace, name
      `;

      const result = await clickHouseService.client.query({
        query,
        format: 'JSONEachRow'
      });

      const applications = await result.json();
      
      // Parse metadata JSON strings
      return applications.map((app: any) => ({
        ...app,
        metadata: app.metadata ? JSON.parse(app.metadata) : {},
        active: Boolean(app.active)
      }));
    } catch (error) {
      logger.error('Failed to get applications', { error, filters });
      throw error;
    }
  }

  async getApplication(id: string): Promise<Application | null> {
    await this.initialize();

    try {
      const query = `
        SELECT * FROM appsentry.applications
        WHERE id = '${id}'
        LIMIT 1
      `;

      const result = await clickHouseService.client.query({
        query,
        format: 'JSONEachRow'
      });

      const applications = await result.json();
      
      if (applications.length === 0) {
        return null;
      }

      const app = applications[0];
      return {
        ...app,
        metadata: app.metadata ? JSON.parse(app.metadata) : {},
        active: Boolean(app.active)
      };
    } catch (error) {
      logger.error('Failed to get application', { error, id });
      throw error;
    }
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application> {
    await this.initialize();

    const now = new Date();
    
    // ClickHouse doesn't support UPDATE directly in MergeTree
    // We need to get the existing record and insert a new one
    const existing = await this.getApplication(id);
    if (!existing) {
      throw new Error(`Application ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id,
      updated_at: now
    };

    try {
      await clickHouseService.client.insert({
        table: 'appsentry.applications',
        values: [{
          ...updated,
          metadata: updated.metadata ? JSON.stringify(updated.metadata) : ''
        }],
        format: 'JSONEachRow'
      });

      return updated;
    } catch (error) {
      logger.error('Failed to update application', { error, id, updates });
      throw error;
    }
  }

  async deleteApplication(id: string): Promise<void> {
    // Soft delete by marking as inactive
    await this.updateApplication(id, { active: false });
  }

  // Health check operations
  async recordHealthCheck(healthCheck: HealthCheck): Promise<void> {
    await this.initialize();

    try {
      await clickHouseService.client.insert({
        table: 'appsentry.health_checks',
        values: [{
          id: healthCheck.id || uuidv4(),
          application_id: healthCheck.application_id,
          check_time: healthCheck.check_time || new Date(),
          status: healthCheck.status,
          response_time_ms: healthCheck.response_time_ms,
          status_code: healthCheck.status_code || 0,
          error_message: healthCheck.error_message || '',
          details: healthCheck.details ? JSON.stringify(healthCheck.details) : '',
          check_type: healthCheck.check_type || 'http'
        }],
        format: 'JSONEachRow'
      });

      // Update application status
      await this.updateApplication(healthCheck.application_id, {
        status: healthCheck.status,
        last_check_time: new Date()
      });
    } catch (error) {
      logger.error('Failed to record health check', { error, healthCheck });
      throw error;
    }
  }

  async getHealthCheckHistory(applicationId: string, options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<HealthCheck[]> {
    await this.initialize();

    const startTime = options?.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endTime = options?.endTime || new Date();
    const limit = options?.limit || 100;

    try {
      const query = `
        SELECT * FROM appsentry.health_checks
        WHERE application_id = '${applicationId}'
          AND check_time >= '${startTime.toISOString()}'
          AND check_time <= '${endTime.toISOString()}'
        ORDER BY check_time DESC
        LIMIT ${limit}
      `;

      const result = await clickHouseService.client.query({
        query,
        format: 'JSONEachRow'
      });

      const healthChecks = await result.json();
      
      return healthChecks.map((check: any) => ({
        ...check,
        details: check.details ? JSON.parse(check.details) : {}
      }));
    } catch (error) {
      logger.error('Failed to get health check history', { error, applicationId });
      throw error;
    }
  }

  async getApplicationSLA(applicationId: string, period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    availability: number;
    avgResponseTime: number;
    totalChecks: number;
    successfulChecks: number;
  }> {
    await this.initialize();

    const periodInterval = {
      hour: '1 HOUR',
      day: '1 DAY',
      week: '7 DAY',
      month: '30 DAY'
    }[period];

    try {
      const query = `
        SELECT 
          count() as total_checks,
          countIf(status = 'healthy') as successful_checks,
          countIf(status = 'degraded') as degraded_checks,
          countIf(status = 'down') as failed_checks,
          avg(response_time_ms) as avg_response_time,
          (successful_checks * 100.0) / total_checks as availability_percentage
        FROM appsentry.health_checks
        WHERE application_id = '${applicationId}'
          AND check_time >= now() - INTERVAL ${periodInterval}
      `;

      const result = await clickHouseService.client.query({
        query,
        format: 'JSONEachRow'
      });

      const data = await result.json();
      
      if (data.length === 0) {
        return {
          availability: 100,
          avgResponseTime: 0,
          totalChecks: 0,
          successfulChecks: 0
        };
      }

      const sla = data[0];
      return {
        availability: sla.availability_percentage || 0,
        avgResponseTime: sla.avg_response_time || 0,
        totalChecks: sla.total_checks || 0,
        successfulChecks: sla.successful_checks || 0
      };
    } catch (error) {
      logger.error('Failed to get application SLA', { error, applicationId, period });
      throw error;
    }
  }
}

export const applicationRegistryService = new ApplicationRegistryService();
export { ApplicationRegistryService, Application, HealthCheck };