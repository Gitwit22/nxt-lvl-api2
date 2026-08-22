import { Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CfEnrollmentStatus, Prisma } from '@prisma/clientflow-client';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCfEnrollmentDto, UpdateCfEnrollmentDto } from './dto/cf-enrollment.dto';

@Injectable({ scope: Scope.REQUEST })
export class EnrollmentService {
  private organizationId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: ClientflowPrismaService,
    private readonly primaryPrisma: PrismaService,
  ) {}

  async list(clientId?: string, programId?: string) {
    const organizationId = await this.getOrganizationId();
    return this.prisma.cfProgramEnrollment.findMany({
      where: {
        organizationId,
        ...(clientId ? { clientId } : {}),
        ...(programId ? { programId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const organizationId = await this.getOrganizationId();
    const enrollment = await this.prisma.cfProgramEnrollment.findFirst({
      where: { id, organizationId },
    });
    if (!enrollment) throw new NotFoundException('Program enrollment not found.');
    return enrollment;
  }

  async create(dto: CreateCfEnrollmentDto) {
    const organizationId = await this.getOrganizationId();
    const [client, program] = await Promise.all([
      this.prisma.cfClient.findFirst({
        where: { id: dto.clientId, organizationId },
        select: { id: true, isDemo: true, assignedStaff: true, assignedUserId: true },
      }),
      this.prisma.cfProgram.findFirst({
        where: { id: dto.programId, organizationId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!client) throw new NotFoundException('Client not found.');
    if (!program) throw new NotFoundException('Active program not found.');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const enrollment = await tx.cfProgramEnrollment.create({
          data: {
            organizationId,
            clientId: client.id,
            programId: program.id,
            status: dto.status ?? CfEnrollmentStatus.interested,
            assignedUserId: dto.assignedUserId ?? client.assignedUserId,
            assignedStaff: dto.assignedStaff ?? client.assignedStaff,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            isDemo: client.isDemo,
          },
        });
        await tx.cfEnrollmentStatusHistory.create({
          data: {
            organizationId,
            enrollmentId: enrollment.id,
            newStatus: enrollment.status,
            changedByUserId: this.actorId,
            reason: 'Program enrollment created.',
          },
        });
        return enrollment;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.cfProgramEnrollment.findFirst({
          where: { organizationId, clientId: dto.clientId, programId: dto.programId },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCfEnrollmentDto) {
    const organizationId = await this.getOrganizationId();
    const existing = await this.prisma.cfProgramEnrollment.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Program enrollment not found.');

    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.cfProgramEnrollment.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.assignedUserId !== undefined && { assignedUserId: dto.assignedUserId }),
          ...(dto.assignedStaff !== undefined && { assignedStaff: dto.assignedStaff }),
          ...(dto.progressPercentage !== undefined && {
            progressPercentage: dto.progressPercentage,
          }),
          ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
          ...(dto.nextActionDate !== undefined && {
            nextActionDate: new Date(dto.nextActionDate),
          }),
          ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
          ...(dto.status === CfEnrollmentStatus.completed && !existing.completedAt
            ? { completedAt: new Date() }
            : {}),
          ...(dto.status === CfEnrollmentStatus.withdrawn && !existing.withdrawnAt
            ? { withdrawnAt: new Date() }
            : {}),
        },
      });

      if (dto.status !== undefined && dto.status !== existing.status) {
        await tx.cfEnrollmentStatusHistory.create({
          data: {
            organizationId,
            enrollmentId: id,
            previousStatus: existing.status,
            newStatus: dto.status,
            changedByUserId: this.actorId,
            reason: dto.statusReason,
          },
        });
      }

      return enrollment;
    });
  }

  async history(id: string) {
    const enrollment = await this.get(id);
    return this.prisma.cfEnrollmentStatusHistory.findMany({
      where: { organizationId: enrollment.organizationId, enrollmentId: enrollment.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  private get actorId(): string | undefined {
    return this.request.headers['x-admin-id'] as string | undefined;
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
    const admin = await this.primaryPrisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found.');
    this.organizationId = admin.organizationId;
    return admin.organizationId;
  }
}
