import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    update: {},
    create: {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Plumbing Solutions AU',
      locale: 'en-AU',
      phoneNumber: '+61400123456',
      configVersion: 'v1.0.0',
      status: 'active',
      metadata: {
        industry: 'plumbing',
        region: 'AU',
      },
    },
  });

  console.log('✅ Created tenant:', tenant.name);

  // Create test configuration
  const config = await prisma.configuration.upsert({
    where: {
      tenantId_version: {
        tenantId: tenant.id,
        version: 'v1.0.0',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      version: 'v1.0.0',
      schemaVersion: 'v1',
      locale: 'en-AU',
      objectives: {
        objectives: [
          {
            id: 'capture_contact',
            type: 'capture_email_au',
            purpose: 'appointment_confirmation',
            required: true,
            on_success: 'next',
          },
          {
            id: 'capture_phone',
            type: 'capture_phone_au',
            purpose: 'callback',
            required: true,
            on_success: 'next',
          },
        ],
      },
      status: 'active',
      createdBy: 'system',
      notes: 'Initial test configuration for development',
    },
  });

  console.log('✅ Created configuration:', config.version);

  // Update tenant to reference config version
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { configVersion: config.version },
  });

  // Create phone routing entry
  const phoneRouting = await prisma.phoneRouting.upsert({
    where: { phoneNumber: '+61400123456' },
    update: {},
    create: {
      phoneNumber: '+61400123456',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Created phone routing:', phoneRouting.phoneNumber);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
