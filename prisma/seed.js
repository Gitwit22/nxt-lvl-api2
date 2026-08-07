const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const programPartition = require('../src/config/program.partition.json');

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: programPartition.organizationSlug },
    update: {
      name: programPartition.organizationName,
    },
    create: {
      name: programPartition.organizationName,
      slug: programPartition.organizationSlug,
      status: 'active',
    },
  });

  const program = await prisma.program.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: programPartition.primaryProgramSlug,
      },
    },
    update: {
      name: programPartition.primaryProgramName,
      type: 'business_directory',
      status: 'active',
    },
    create: {
      organizationId: organization.id,
      name: programPartition.primaryProgramName,
      slug: programPartition.primaryProgramSlug,
      type: 'business_directory',
      status: 'active',
      settings: {},
    },
  });

  const cinemaStudioProgram = await prisma.program.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'cinema-studio',
      },
    },
    update: {
      name: 'Cinema Studio',
      type: 'business_directory',
      status: 'active',
    },
    create: {
      organizationId: organization.id,
      name: 'Cinema Studio',
      slug: 'cinema-studio',
      type: 'business_directory',
      status: 'active',
      settings: {},
    },
  });

  const defaultCategories = [
    'Technology',
    'Healthcare',
    'Education',
    'Consulting',
    'Legal',
    'Nonprofit',
  ];

  for (let index = 0; index < defaultCategories.length; index += 1) {
    const category = defaultCategories[index];
    await prisma.businessCategory.upsert({
      where: {
        programId_slug: {
          programId: program.id,
          slug: category.toLowerCase().replace(/\s+/g, '-'),
        },
      },
      update: {
        isActive: true,
        sortOrder: index,
      },
      create: {
        programId: program.id,
        name: category,
        slug: category.toLowerCase().replace(/\s+/g, '-'),
        sortOrder: index,
      },
    });
  }

  const cinemaCategories = [
    'Video Production',
    'Post Production',
    'Motion Graphics',
    'Animation',
    'Color Grading',
    'Sound Design',
  ];

  for (let index = 0; index < cinemaCategories.length; index += 1) {
    const category = cinemaCategories[index];
    await prisma.businessCategory.upsert({
      where: {
        programId_slug: {
          programId: cinemaStudioProgram.id,
          slug: category.toLowerCase().replace(/\s+/g, '-'),
        },
      },
      update: {
        isActive: true,
        sortOrder: index,
      },
      create: {
        programId: cinemaStudioProgram.id,
        name: category,
        slug: category.toLowerCase().replace(/\s+/g, '-'),
        sortOrder: index,
      },
    });
  }

  // Platform admin (NXT LVL Tech) — no org membership, platform_super_admin
  const adminPassword = await hash('4755Dett', 10);
  await prisma.adminUser.upsert({
    where: { email: 'nxtlvltechllc@gmail.com' },
    update: {
      isActive: true,
      platformRole: 'platform_super_admin',
      passwordHash: adminPassword,
    },
    create: {
      email: 'nxtlvltechllc@gmail.com',
      passwordHash: adminPassword,
      platformRole: 'platform_super_admin',
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });

  // EA Lake — org_owner of the seeded organization
  const eaPassword = await hash('mbba2026', 10);
  const eaLake = await prisma.adminUser.upsert({
    where: { email: 'ea.lake@ea-management.app' },
    update: { isActive: true, passwordHash: eaPassword },
    create: {
      email: 'ea.lake@ea-management.app',
      passwordHash: eaPassword,
      firstName: 'EA',
      lastName: 'Lake',
    },
  });
  await prisma.organizationMember.upsert({
    where: { adminUserId_organizationId: { adminUserId: eaLake.id, organizationId: organization.id } },
    update: { organizationRole: 'org_owner', isActive: true },
    create: { adminUserId: eaLake.id, organizationId: organization.id, organizationRole: 'org_owner' },
  });

  // EA Staff — org_admin of the seeded organization
  const eaStaff = await prisma.adminUser.upsert({
    where: { email: 'staff@ea-management.app' },
    update: { isActive: true, passwordHash: eaPassword },
    create: {
      email: 'staff@ea-management.app',
      passwordHash: eaPassword,
      firstName: 'EA',
      lastName: 'Staff',
    },
  });
  await prisma.organizationMember.upsert({
    where: { adminUserId_organizationId: { adminUserId: eaStaff.id, organizationId: organization.id } },
    update: { organizationRole: 'org_admin', isActive: true },
    create: { adminUserId: eaStaff.id, organizationId: organization.id, organizationRole: 'org_admin' },
  });

  console.log('Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
