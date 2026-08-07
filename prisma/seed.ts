import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import programPartition from '../src/config/program.partition.json';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ===== PHASE 1: Organization Setup =====
  console.log('\n📦 Phase 1: Creating organization...');

  const organization = await prisma.organization.upsert({
    where: { slug: programPartition.organizationSlug },
    update: {
      name: programPartition.organizationName,
      settings: {
        companyName: programPartition.organizationName,
        timezone: programPartition.timezone || 'America/Detroit',
        currency: programPartition.currency || 'USD',
        environment: programPartition.environment || 'demo',
        branding: {
          logoUrl: null,
          primaryColor: null,
        },
        features: {
          fundingPrograms: true,
          documentManagement: true,
          financialTracking: true,
          communications: true,
        },
      },
    },
    create: {
      name: programPartition.organizationName,
      slug: programPartition.organizationSlug,
      status: 'active',
      settings: {
        companyName: programPartition.organizationName,
        timezone: programPartition.timezone || 'America/Detroit',
        currency: programPartition.currency || 'USD',
        environment: programPartition.environment || 'demo',
        branding: {
          logoUrl: null,
          primaryColor: null,
        },
        features: {
          fundingPrograms: true,
          documentManagement: true,
          financialTracking: true,
          communications: true,
        },
      },
    },
  });

  console.log(`✅ Organization created: ${organization.name} (${organization.id})`);

  // ===== PHASE 1: Programs Setup =====
  console.log('\n📋 Phase 1: Creating programs...');

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

  console.log(`✅ Program created: ${program.name} (${program.id})`);

  // Secondary: Cinema Studio program for testing
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

  // Secondary: FBA App (BlackNBiz business directory)
  const fbaProgram = await prisma.program.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'fba-app',
      },
    },
    update: {
      name: 'BlackNBiz Business Directory',
      type: 'business_directory',
      status: 'active',
    },
    create: {
      organizationId: organization.id,
      name: 'BlackNBiz Business Directory',
      slug: 'fba-app',
      type: 'business_directory',
      status: 'active',
      settings: {},
    },
  });
  console.log(`✅ FBA App program: ${fbaProgram.id}`);

  // Default categories for main program (client-intake)
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

  // Categories for fba-app (BlackNBiz business directory)
  const fbaCategories = [
    'Restaurants & Food',
    'Beauty & Personal Care',
    'Retail & Boutiques',
    'Health & Wellness',
    'Finance & Insurance',
    'Technology',
    'Home Services',
    'Consulting & Professional Services',
    'Education & Tutoring',
    'Legal Services',
    'Nonprofit',
    'Events & Entertainment',
    'Automotive',
    'Real Estate',
    'Media & Marketing',
  ];

  for (let index = 0; index < fbaCategories.length; index += 1) {
    const category = fbaCategories[index];
    await prisma.businessCategory.upsert({
      where: {
        programId_slug: {
          programId: fbaProgram.id,
          slug: category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[^a-z0-9-]/g, ''),
        },
      },
      update: {
        isActive: true,
        sortOrder: index,
      },
      create: {
        programId: fbaProgram.id,
        name: category,
        slug: category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[^a-z0-9-]/g, ''),
        sortOrder: index,
      },
    });
  }

  // ===== PHASE 2: Authentication - Admin Users =====
  console.log('\n👥 Phase 2: Creating admin users with correct role hierarchy...');

  // Admin passwords for production use
  const passwords = {
    nxtLvlTech: '4755Dett',               // NXT LVL Tech - Platform Super Admin
    eaOwner: 'mbba2026',                  // EA Lake - Organization Owner
    eaAdmin: 'mbba2026',                  // EA Staff - Organization Admin (using same password for demo)
  };

  // Phase 2.1: NXT LVL Tech - Platform Super Administrator
  // This user is platform-wide and can access multiple organizations
  const nxtLvlTechPassword = await hash(passwords.nxtLvlTech, 10);
  const nxtLvlTech = await prisma.adminUser.upsert({
    where: { email: 'nxtlvltechllc@gmail.com' },
    update: {
      isActive: true,
      platformRole: 'platform_super_admin',
      passwordHash: nxtLvlTechPassword,
    },
    create: {
      email: 'nxtlvltechllc@gmail.com',
      passwordHash: nxtLvlTechPassword,
      firstName: 'NXT LVL',
      lastName: 'Tech',
      platformRole: 'platform_super_admin',
      isActive: true,
    },
  });
  console.log(`✅ ${nxtLvlTech.firstName} ${nxtLvlTech.lastName} (platform_super_admin - system-wide access)`);

  // Phase 2.2: EA Lake - Organization Owner
  // This user owns and controls the EA Management organization
  const eaOwnerPassword = await hash(passwords.eaOwner, 10);
  const eaLake = await prisma.adminUser.upsert({
    where: { email: 'ea.lake@ea-management.app' },
    update: {
      isActive: true,
      passwordHash: eaOwnerPassword,
    },
    create: {
      email: 'ea.lake@ea-management.app',
      passwordHash: eaOwnerPassword,
      firstName: 'EA',
      lastName: 'Lake',
      isActive: true,
    },
  });

  // Add EA Lake as organization owner
  await prisma.organizationMember.upsert({
    where: {
      adminUserId_organizationId: {
        adminUserId: eaLake.id,
        organizationId: organization.id,
      },
    },
    update: {
      organizationRole: 'org_owner',
      isActive: true,
    },
    create: {
      adminUserId: eaLake.id,
      organizationId: organization.id,
      organizationRole: 'org_owner',
      isActive: true,
      joinedAt: new Date(),
    },
  });
  console.log(`✅ ${eaLake.firstName} ${eaLake.lastName} (org_owner - EA Management LLC)`);

  // Phase 2.3: EA Staff - Organization Administrator
  // This user has administrative privileges within EA Management organization
  const eaAdminPassword = await hash(passwords.eaAdmin, 10);
  const eaStaff = await prisma.adminUser.upsert({
    where: { email: 'staff@ea-management.app' },
    update: {
      isActive: true,
      passwordHash: eaAdminPassword,
    },
    create: {
      email: 'staff@ea-management.app',
      passwordHash: eaAdminPassword,
      firstName: 'EA',
      lastName: 'Staff',
      isActive: true,
    },
  });

  // Add EA Staff as organization admin
  await prisma.organizationMember.upsert({
    where: {
      adminUserId_organizationId: {
        adminUserId: eaStaff.id,
        organizationId: organization.id,
      },
    },
    update: {
      organizationRole: 'org_admin',
      isActive: true,
    },
    create: {
      adminUserId: eaStaff.id,
      organizationId: organization.id,
      organizationRole: 'org_admin',
      isActive: true,
      joinedAt: new Date(),
      invitedByMemberId: eaLake.id, // Invited by organization owner
    },
  });
  console.log(`✅ ${eaStaff.firstName} ${eaStaff.lastName} (org_admin - EA Management LLC)`);

  console.log('\n📋 Seed Summary:');
  console.log(`   Organization: ${organization.name}`);
  console.log(`   Program: ${program.name}`);
  console.log(`   Users: 3`);
  console.log(`     - NXT LVL Tech (platform_super_admin - can access all organizations)`);
  console.log(`     - EA Lake (org_owner - owns EA Management LLC)`);
  console.log(`     - EA Staff (org_admin - manages EA Management LLC)`);
  console.log('\n✨ Seeding complete!');
  console.log('\n🔐 Test Credentials:');
  console.log(`\n   PLATFORM ADMIN (system-wide):`);
  console.log(`   Email: nxtlvltechllc@gmail.com`);
  console.log(`   Password: ${passwords.nxtLvlTech}`);
  console.log(`\n   ORGANIZATION OWNER (EA Management):`)  ;
  console.log(`   Email: ea.lake@ea-management.app`);
  console.log(`   Password: ${passwords.eaOwner}`);
  console.log(`\n   ORGANIZATION ADMIN (EA Management):`);
  console.log(`   Email: staff@ea-management.app`);
  console.log(`   Password: ${passwords.eaAdmin}`);
  console.log(`\n   Roles & Access:`);
  console.log(`   - platform_super_admin: Full system access`);
  console.log(`   - org_owner: Full control of organization (cannot be changed by others)`);
  console.log(`   - org_admin: Can manage users and resources in organization`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Seeding error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

