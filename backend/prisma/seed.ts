import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create a default admin user (this would typically be created via Azure AD)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      id: 'admin-user-id-from-azure-ad',
      email: 'admin@company.com',
      displayName: 'System Administrator',
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.admin,
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create some sample applications for testing
  const sampleApps = [
    {
      name: 'user-service',
      displayName: 'User Service API',
      description: 'Core user management service',
      environment: 'production' as const,
      category: 'api',
      healthUrl: 'https://user-service.company.com/health',
      loginUrl: 'https://user-service.company.com/login',
      config: {
        healthCheck: {
          timeout: 5000,
          expectedStatus: [200],
          expectedResponse: { status: 'healthy' },
        },
        loginTest: {
          enabled: true,
          timeout: 30000,
          screenshotOnFailure: true,
        },
      },
      ownerTeam: 'Platform Team',
      ownerEmail: 'platform@company.com',
      tags: ['core', 'user-management'],
    },
    {
      name: 'auth-service',
      displayName: 'Authentication Service',
      description: 'Authentication and authorization service',
      environment: 'production' as const,
      category: 'api',
      healthUrl: 'https://auth-service.company.com/health',
      config: {
        healthCheck: {
          timeout: 3000,
          expectedStatus: [200],
          expectedResponse: { status: 'ok' },
        },
        loginTest: {
          enabled: false,
        },
      },
      ownerTeam: 'Security Team',
      ownerEmail: 'security@company.com',
      tags: ['core', 'auth'],
    },
    {
      name: 'payment-api',
      displayName: 'Payment Processing API',
      description: 'Handles payment transactions and billing',
      environment: 'production' as const,
      category: 'api',
      healthUrl: 'https://payment-api.company.com/health',
      config: {
        healthCheck: {
          timeout: 10000,
          expectedStatus: [200],
        },
        loginTest: {
          enabled: false,
        },
      },
      ownerTeam: 'Finance Team',
      ownerEmail: 'finance@company.com',
      tags: ['payment', 'critical'],
    },
    {
      name: 'user-dashboard',
      displayName: 'User Dashboard',
      description: 'Main user interface dashboard',
      environment: 'production' as const,
      category: 'frontend',
      healthUrl: 'https://dashboard.company.com/health',
      loginUrl: 'https://dashboard.company.com/login',
      config: {
        healthCheck: {
          timeout: 5000,
          expectedStatus: [200],
        },
        loginTest: {
          enabled: true,
          timeout: 30000,
          screenshotOnFailure: true,
          steps: [
            {
              type: 'navigate',
              url: 'https://dashboard.company.com/login',
              description: 'Navigate to login page',
            },
            {
              type: 'type',
              selector: 'input[name="email"]',
              text: '{username}',
              description: 'Enter username',
            },
            {
              type: 'type',
              selector: 'input[name="password"]',
              text: '{password}',
              description: 'Enter password',
            },
            {
              type: 'click',
              selector: 'button[type="submit"]',
              description: 'Click login button',
            },
            {
              type: 'wait',
              selector: '[data-testid="dashboard"]',
              timeout: 10000,
              description: 'Wait for dashboard to load',
            },
          ],
          successCriteria: {
            selectors: ['[data-testid="dashboard"]', '.user-menu'],
          },
        },
      },
      ownerTeam: 'Frontend Team',
      ownerEmail: 'frontend@company.com',
      tags: ['frontend', 'user-facing'],
    },
  ];

  for (const appData of sampleApps) {
    const app = await prisma.application.upsert({
      where: { name: appData.name },
      update: {},
      create: {
        ...appData,
        createdBy: adminUser.id,
        lastModifiedBy: adminUser.id,
      },
    });
    console.log('✅ Created application:', app.name);
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });