import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import clientflowPartition from '../src/config/partitions/clientflow.partition.json';
import fbaAppPartition from '../src/config/partitions/fba-app.partition.json';

const prisma = new PrismaClient();

async function main() {
  const programPartitions = [fbaAppPartition, clientflowPartition];
  const programPartition = fbaAppPartition;
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

  const programs = await Promise.all(
    programPartitions.map((partition) =>
      prisma.program.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: partition.primaryProgramSlug,
          },
        },
        update: {
          name: partition.primaryProgramName,
          type: 'business_directory',
          status: 'active',
        },
        create: {
          organizationId: organization.id,
          name: partition.primaryProgramName,
          slug: partition.primaryProgramSlug,
          type: 'business_directory',
          status: 'active',
          settings: {},
        },
      }),
    ),
  );
  const program = programs[0];

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

  const adminPassword = await hash('4755Dett', 10);
  const organizationAdminPassword = await hash('mbba2026', 10);

  await prisma.adminUser.upsert({
    where: { email: 'nxtlvltechllc@gmail.com' },
    update: {
      organizationId: organization.id,
      isActive: true,
      role: 'super_admin',
      passwordHash: adminPassword,
    },
    create: {
      organizationId: organization.id,
      email: 'nxtlvltechllc@gmail.com',
      passwordHash: adminPassword,
      role: 'super_admin',
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });

  await prisma.adminUser.upsert({
    where: { email: 'eammanagementllc@gmail.com' },
    update: {
      organizationId: organization.id,
      isActive: true,
      role: 'org_admin',
      passwordHash: organizationAdminPassword,
    },
    create: {
      organizationId: organization.id,
      email: 'eammanagementllc@gmail.com',
      passwordHash: organizationAdminPassword,
      role: 'org_admin',
      firstName: 'EA Management',
      lastName: 'Admin',
    },
  });
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
