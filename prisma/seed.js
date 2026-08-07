'use strict';
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const programPartition = require('../src/config/program.partition.json');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
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
        branding: { logoUrl: null, primaryColor: null },
        features: { fundingPrograms: true, documentManagement: true, financialTracking: true, communications: true },
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
        branding: { logoUrl: null, primaryColor: null },
        features: { fundingPrograms: true, documentManagement: true, financialTracking: true, communications: true },
      },
    },
  });
  console.log(`✅ Organization: ${organization.name} (${organization.id})`);

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
  console.log(`✅ Primary program: ${program.name}`);

  const cinemaStudioProgram = await prisma.program.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: 'cinema-studio' } },
    update: { name: 'Cinema Studio', type: 'business_directory', status: 'active' },
    create: { organizationId: organization.id, name: 'Cinema Studio', slug: 'cinema-studio', type: 'business_directory', status: 'active', settings: {} },
  });

  const fbaProgram = await prisma.program.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: 'fba-app' } },
    update: { name: 'BlackNBiz Business Directory', type: 'business_directory', status: 'active' },
    create: { organizationId: organization.id, name: 'BlackNBiz Business Directory', slug: 'fba-app', type: 'business_directory', status: 'active', settings: {} },
  });
  console.log(`✅ FBA App program: ${fbaProgram.id}`);

  // Categories for primary program (client-intake)
  const defaultCategories = ['Technology', 'Healthcare', 'Education', 'Consulting', 'Legal', 'Nonprofit'];
  for (let i = 0; i < defaultCategories.length; i++) {
    const cat = defaultCategories[i];
    await prisma.businessCategory.upsert({
      where: { programId_slug: { programId: program.id, slug: cat.toLowerCase().replace(/\s+/g, '-') } },
      update: { isActive: true, sortOrder: i },
      create: { programId: program.id, name: cat, slug: cat.toLowerCase().replace(/\s+/g, '-'), sortOrder: i },
    });
  }

  // Categories for cinema-studio
  const cinemaCategories = ['Video Production', 'Post Production', 'Motion Graphics', 'Animation', 'Color Grading', 'Sound Design'];
  for (let i = 0; i < cinemaCategories.length; i++) {
    const cat = cinemaCategories[i];
    await prisma.businessCategory.upsert({
      where: { programId_slug: { programId: cinemaStudioProgram.id, slug: cat.toLowerCase().replace(/\s+/g, '-') } },
      update: { isActive: true, sortOrder: i },
      create: { programId: cinemaStudioProgram.id, name: cat, slug: cat.toLowerCase().replace(/\s+/g, '-'), sortOrder: i },
    });
  }

  // Categories for fba-app (BlackNBiz)
  const fbaCategories = [
    'Restaurants & Food', 'Beauty & Personal Care', 'Retail & Boutiques', 'Health & Wellness',
    'Finance & Insurance', 'Technology', 'Home Services', 'Consulting & Professional Services',
    'Education & Tutoring', 'Legal Services', 'Nonprofit', 'Events & Entertainment',
    'Automotive', 'Real Estate', 'Media & Marketing',
  ];
  for (let i = 0; i < fbaCategories.length; i++) {
    const cat = fbaCategories[i];
    const slug = cat.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and').replace(/[^a-z0-9-]/g, '');
    await prisma.businessCategory.upsert({
      where: { programId_slug: { programId: fbaProgram.id, slug } },
      update: { isActive: true, sortOrder: i },
      create: { programId: fbaProgram.id, name: cat, slug, sortOrder: i },
    });
  }

  // ===== PHASE 2: Admin Users =====
  console.log('\n👥 Phase 2: Creating admin users...');

  const nxtLvlTechPassword = await hash('4755Dett', 10);
  const nxtLvlTech = await prisma.adminUser.upsert({
    where: { email: 'nxtlvltechllc@gmail.com' },
    update: { isActive: true, platformRole: 'platform_super_admin', passwordHash: nxtLvlTechPassword },
    create: { email: 'nxtlvltechllc@gmail.com', passwordHash: nxtLvlTechPassword, firstName: 'NXT LVL', lastName: 'Tech', platformRole: 'platform_super_admin', isActive: true },
  });
  console.log(`✅ ${nxtLvlTech.firstName} ${nxtLvlTech.lastName} (platform_super_admin)`);

  const eaPassword = await hash('mbba2026', 10);
  const eaLake = await prisma.adminUser.upsert({
    where: { email: 'ea.lake@ea-management.app' },
    update: { isActive: true, passwordHash: eaPassword },
    create: { email: 'ea.lake@ea-management.app', passwordHash: eaPassword, firstName: 'EA', lastName: 'Lake', isActive: true },
  });
  await prisma.organizationMember.upsert({
    where: { adminUserId_organizationId: { adminUserId: eaLake.id, organizationId: organization.id } },
    update: { organizationRole: 'org_owner', isActive: true },
    create: { adminUserId: eaLake.id, organizationId: organization.id, organizationRole: 'org_owner', isActive: true, joinedAt: new Date() },
  });
  console.log(`✅ ${eaLake.firstName} ${eaLake.lastName} (org_owner)`);

  const eaStaff = await prisma.adminUser.upsert({
    where: { email: 'staff@ea-management.app' },
    update: { isActive: true, passwordHash: eaPassword },
    create: { email: 'staff@ea-management.app', passwordHash: eaPassword, firstName: 'EA', lastName: 'Staff', isActive: true },
  });
  await prisma.organizationMember.upsert({
    where: { adminUserId_organizationId: { adminUserId: eaStaff.id, organizationId: organization.id } },
    update: { organizationRole: 'org_admin', isActive: true },
    create: { adminUserId: eaStaff.id, organizationId: organization.id, organizationRole: 'org_admin', isActive: true, joinedAt: new Date() },
  });
  console.log(`✅ ${eaStaff.firstName} ${eaStaff.lastName} (org_admin)`);

  console.log('\n✨ Seeding complete!');
  console.log('   nxtlvltechllc@gmail.com / 4755Dett  (platform_super_admin)');
  console.log('   ea.lake@ea-management.app / mbba2026  (org_owner)');
  console.log('   staff@ea-management.app / mbba2026    (org_admin)');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error('❌ Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
