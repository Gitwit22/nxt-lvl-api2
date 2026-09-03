import { PrismaClient } from '../src/generated/clientflow';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const targetEmail = 'eamanagementllc@gmail.com';
const legacyUserId = 'user_alicia';
const legacyDisplayName = 'Alicia Monroe';

async function main() {
  const matches = await prisma.adminUser.findMany({
    where: { email: { equals: targetEmail, mode: 'insensitive' }, isActive: true },
    select: { id: true, organizationId: true, email: true, firstName: true, lastName: true },
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one active ${targetEmail} account; found ${matches.length}.`);
  }

  const actor = matches[0];
  const scope = { organizationId: actor.organizationId };
  const displayName = [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.email;
  const counts = {
    activities: await prisma.cfActivityLog.count({
      where: { ...scope, OR: [{ user: legacyDisplayName }, { actorUserId: legacyUserId }] },
    }),
    clients: await prisma.cfClient.count({ where: { ...scope, assignedUserId: legacyUserId } }),
    formAssignments: await prisma.cfFormAssignment.count({
      where: {
        ...scope,
        OR: [{ assignedUserId: legacyUserId }, { createdByUserId: legacyUserId }],
      },
    }),
    enrollments: await prisma.cfProgramEnrollment.count({
      where: { ...scope, assignedUserId: legacyUserId },
    }),
    enrollmentHistory: await prisma.cfEnrollmentStatusHistory.count({
      where: { ...scope, changedByUserId: legacyUserId },
    }),
    tasks: await prisma.cfTask.count({ where: { ...scope, assignedUserId: legacyUserId } }),
  };

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', actor, displayName, counts }, null, 2));
  if (!apply) return;

  await prisma.$transaction([
    prisma.cfActivityLog.updateMany({
      where: { ...scope, user: legacyDisplayName },
      data: { user: displayName, actorUserId: actor.id },
    }),
    prisma.cfActivityLog.updateMany({
      where: { ...scope, actorUserId: legacyUserId },
      data: { actorUserId: actor.id, user: displayName },
    }),
    prisma.cfClient.updateMany({
      where: { ...scope, assignedUserId: legacyUserId },
      data: { assignedUserId: actor.id, assignedStaff: displayName },
    }),
    prisma.cfFormAssignment.updateMany({
      where: { ...scope, assignedUserId: legacyUserId },
      data: { assignedUserId: actor.id },
    }),
    prisma.cfFormAssignment.updateMany({
      where: { ...scope, createdByUserId: legacyUserId },
      data: { createdByUserId: actor.id },
    }),
    prisma.cfProgramEnrollment.updateMany({
      where: { ...scope, assignedUserId: legacyUserId },
      data: { assignedUserId: actor.id, assignedStaff: displayName },
    }),
    prisma.cfEnrollmentStatusHistory.updateMany({
      where: { ...scope, changedByUserId: legacyUserId },
      data: { changedByUserId: actor.id },
    }),
    prisma.cfTask.updateMany({
      where: { ...scope, assignedUserId: legacyUserId },
      data: { assignedUserId: actor.id, assignedStaff: displayName },
    }),
    prisma.cfProgramProgressTemplateVersion.updateMany({
      where: { ...scope, publishedByUserId: legacyUserId },
      data: { publishedByUserId: actor.id },
    }),
    prisma.cfProgramMonitoringTemplateVersion.updateMany({
      where: { ...scope, publishedByUserId: legacyUserId },
      data: { publishedByUserId: actor.id },
    }),
    prisma.cfEnrollmentProgressPlan.updateMany({
      where: { ...scope, replacedByUserId: legacyUserId },
      data: { replacedByUserId: actor.id },
    }),
    prisma.cfEnrollmentProgressCheckpoint.updateMany({
      where: { ...scope, completedByUserId: legacyUserId },
      data: { completedByUserId: actor.id },
    }),
    prisma.cfEnrollmentCheckpointEvidence.updateMany({
      where: { ...scope, addedByUserId: legacyUserId },
      data: { addedByUserId: actor.id },
    }),
    prisma.cfEnrollmentMonitoringHistory.updateMany({
      where: { ...scope, reviewedByUserId: legacyUserId },
      data: { reviewedByUserId: actor.id },
    }),
    prisma.cfEnrollmentMonitoringEvidence.updateMany({
      where: { ...scope, addedByUserId: legacyUserId },
      data: { addedByUserId: actor.id },
    }),
  ]);

  console.log('Legacy Alicia attribution reassigned successfully.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());