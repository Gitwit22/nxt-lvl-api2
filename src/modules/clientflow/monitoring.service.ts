import { BadRequestException, Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CfMonitoringFrequency } from '../../generated/clientflow';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import {
  CreateCfEnrollmentMonitoringDto,
  RecordCfEnrollmentMonitoringResultDto,
} from './dto/cf-enrollment-monitoring.dto';

const FREQUENCY_MONTHS: Partial<Record<CfMonitoringFrequency, number>> = {
  [CfMonitoringFrequency.monthly]: 1,
  [CfMonitoringFrequency.quarterly]: 3,
  [CfMonitoringFrequency.annually]: 12,
};

function nextReviewDate(
  frequency: CfMonitoringFrequency,
  reviewedAt: Date,
  customIntervalDays?: number | null,
): Date | null {
  if (frequency === CfMonitoringFrequency.once) return null;
  const next = new Date(reviewedAt);
  if (frequency === CfMonitoringFrequency.weekly) {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (frequency === CfMonitoringFrequency.custom) {
    if (!customIntervalDays) throw new BadRequestException('Custom monitoring requires an interval.');
    next.setUTCDate(next.getUTCDate() + customIntervalDays);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + (FREQUENCY_MONTHS[frequency] ?? 0));
  return next;
}

@Injectable({ scope: Scope.REQUEST })
export class MonitoringService {
  private organizationId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: ClientflowPrismaService,
  ) {}

  async list(enrollmentId?: string) {
    const organizationId = await this.getOrganizationId();
    return this.prisma.cfEnrollmentMonitoring.findMany({
      where: { organizationId, ...(enrollmentId ? { enrollmentId } : {}) },
      orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(enrollmentId: string, dto: CreateCfEnrollmentMonitoringDto) {
    const organizationId = await this.getOrganizationId();
    const enrollment = await this.getEnrollment(enrollmentId, organizationId);
    if (dto.frequency === CfMonitoringFrequency.custom && !dto.customIntervalDays) {
      throw new BadRequestException('customIntervalDays is required for custom monitoring.');
    }

    return this.prisma.cfEnrollmentMonitoring.create({
      data: {
        organizationId,
        enrollmentId,
        name: dto.name,
        description: dto.description,
        frequency: dto.frequency,
        customIntervalDays: dto.customIntervalDays,
        expectedValue: dto.expectedValue,
        unit: dto.unit,
        nextReviewAt: dto.nextReviewAt ? new Date(dto.nextReviewAt) : null,
        assignedReviewerId: dto.assignedReviewerId,
        evidenceRequired: dto.evidenceRequired ?? false,
        notes: dto.notes,
        isDemo: enrollment.isDemo,
      },
    });
  }

  async recordResult(id: string, dto: RecordCfEnrollmentMonitoringResultDto) {
    const organizationId = await this.getOrganizationId();
    const actor = await this.getActor(organizationId);
    const monitoring = await this.prisma.cfEnrollmentMonitoring.findFirst({
      where: { id, organizationId },
    });
    if (!monitoring) throw new NotFoundException('Enrollment monitoring record not found.');

    const enrollment = await this.getEnrollment(monitoring.enrollmentId, organizationId);
    const reviewedAt = dto.reviewedAt ? new Date(dto.reviewedAt) : new Date();
    const calculatedNextReview = dto.nextReviewAt
      ? new Date(dto.nextReviewAt)
      : nextReviewDate(monitoring.frequency, reviewedAt, monitoring.customIntervalDays);
    const expectedValue = dto.expectedValue ?? monitoring.expectedValue;
    const unit = dto.unit ?? monitoring.unit;
    const followUpRequired = dto.followUpRequired ?? false;

    return this.prisma.$transaction(async (tx) => {
      const history = await tx.cfEnrollmentMonitoringHistory.create({
        data: {
          organizationId,
          enrollmentId: monitoring.enrollmentId,
          enrollmentMonitoringId: monitoring.id,
          expectedValue,
          actualValue: dto.actualValue,
          unit,
          complianceStatus: dto.complianceStatus,
          reviewedAt,
          nextReviewAt: calculatedNextReview,
          reviewedByUserId: actor.id,
          followUpRequired,
          notes: dto.notes,
          previousValue: {
            actualValue: monitoring.actualValue?.toString() ?? null,
            complianceStatus: monitoring.complianceStatus,
          },
          newValue: {
            actualValue: dto.actualValue ?? null,
            complianceStatus: dto.complianceStatus,
          },
          isDemo: monitoring.isDemo,
        },
      });
      await tx.cfEnrollmentMonitoring.update({
        where: { id },
        data: {
          expectedValue,
          actualValue: dto.actualValue,
          unit,
          complianceStatus: dto.complianceStatus,
          lastReviewedAt: reviewedAt,
          nextReviewAt: calculatedNextReview,
          followUpRequired,
          notes: dto.notes ?? monitoring.notes,
        },
      });
      await tx.cfActivityLog.create({
        data: {
          organizationId,
          clientId: enrollment.clientId,
          enrollmentId: enrollment.id,
          action: 'monitoring_result_entered',
          description: `Monitoring result entered for ${monitoring.name}.`,
          user: actor.displayName,
          isDemo: monitoring.isDemo,
        },
      });
      return history;
    });
  }

  async history(id: string) {
    const organizationId = await this.getOrganizationId();
    const monitoring = await this.prisma.cfEnrollmentMonitoring.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!monitoring) throw new NotFoundException('Enrollment monitoring record not found.');
    return this.prisma.cfEnrollmentMonitoringHistory.findMany({
      where: { organizationId, enrollmentMonitoringId: id },
      orderBy: { reviewedAt: 'desc' },
    });
  }

  private get actorId(): string | undefined {
    return this.request.headers['x-admin-id'] as string | undefined;
  }

  private async getActor(organizationId: string) {
    const actorId = this.actorId;
    if (!actorId) throw new NotFoundException('Admin context missing.');
    const actor = await this.prisma.adminUser.findFirst({
      where: { id: actorId, organizationId, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!actor) throw new NotFoundException('Active organization member not found.');
    return {
      id: actor.id,
      displayName: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.email,
    };
  }

  private async getEnrollment(enrollmentId: string, organizationId: string) {
    const enrollment = await this.prisma.cfProgramEnrollment.findFirst({
      where: { id: enrollmentId, organizationId },
      select: { id: true, clientId: true, isDemo: true },
    });
    if (!enrollment) throw new NotFoundException('Program enrollment not found.');
    return enrollment;
  }

  private async getOrganizationId(): Promise<string> {
    if (this.organizationId) return this.organizationId;
    const fromToken = this.request.headers['x-org-id'] as string | undefined;
    if (fromToken) {
      this.organizationId = fromToken;
      return fromToken;
    }
    const adminId = this.actorId;
    if (!adminId) throw new NotFoundException('Admin context missing.');
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found.');
    this.organizationId = admin.organizationId;
    return admin.organizationId;
  }
}