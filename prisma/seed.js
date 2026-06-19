const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: 'nxt-lvl' },
    update: {
      name: 'NXT LVL Technology Solutions',
    },
    create: {
      name: 'NXT LVL Technology Solutions',
      slug: 'nxt-lvl',
      status: 'active',
    },
  });

  const program = await prisma.program.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'fba-app',
      },
    },
    update: {
      name: 'FBA App',
      type: 'business_directory',
      status: 'active',
    },
    create: {
      organizationId: organization.id,
      name: 'FBA App',
      slug: 'fba-app',
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

  const adminPassword = await hash('4755Dett', 10);

  await prisma.adminUser.upsert({
    where: { email: 'nxtlvltechllc@gmail.com' },
    update: {
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
