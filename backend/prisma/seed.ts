import { PrismaClient, UserRole, Environment } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create a default admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      username: 'admin',
      passwordHash: 'supersecret', // In a real app, this would be a proper hash
      displayName: 'System Administrator',
      role: UserRole.admin,
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create a default team
  const defaultTeam = await prisma.team.upsert({
    where: { name: 'Default Team' },
    update: {},
    create: {
      name: 'Default Team',
      description: 'Default team for all applications',
    },
  });

  console.log('✅ Created default team:', defaultTeam.name);

  // Add admin user to the default team
  await prisma.teamMembership.upsert({
    where: {
      userId_teamId: {
        userId: adminUser.id,
        teamId: defaultTeam.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      teamId: defaultTeam.id,
      role: 'admin',
    },
  });

  console.log('✅ Added admin user to default team');

  // Create some sample applications for testing
  const sampleApps = [
    {
      name: 'user-service',
      displayName: 'User Service API',
      description: 'Core user management service',
      environment: Environment.production,
      healthUrl: 'https://user-service.company.com/health',
    },
    {
      name: 'auth-service',
      displayName: 'Authentication Service',
      description: 'Authentication and authorization service',
      environment: Environment.production,
      healthUrl: 'https://auth-service.company.com/health',
    },
    {
      name: 'payment-api',
      displayName: 'Payment Processing API',
      description: 'Handles payment transactions and billing',
      environment: Environment.production,
      healthUrl: 'https://payment-api.company.com/health',
    },
    {
      name: 'user-dashboard',
      displayName: 'User Dashboard',
      description: 'Main user interface dashboard',
      environment: Environment.production,
      healthUrl: 'https://dashboard.company.com/health',
    },
  ];

  for (const appData of sampleApps) {
    const app = await prisma.application.upsert({
      where: { name: appData.name },
      update: {},
      create: {
        ...appData,
        teamId: defaultTeam.id,
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
