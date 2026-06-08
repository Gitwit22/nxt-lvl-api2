import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChangeRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  listPending() {
    return this.prisma.businessChangeRequest.findMany({
      where: { status: 'pending_review' },
      orderBy: { createdAt: 'desc' },
      include: { business: true },
    });
  }

  async approve(requestId: string, adminId: string) {
    const request = await this.prisma.businessChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Change request not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.businessChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedByAdminId: adminId,
        },
      });

      await tx.business.update({
        where: { id: request.businessId },
        data: request.payload as Record<string, unknown>,
      });

      return tx.businessChangeRequest.findUnique({ where: { id: requestId } });
    });
  }

  async reject(requestId: string, adminId: string) {
    const request = await this.prisma.businessChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Change request not found.');
    }

    return this.prisma.businessChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      },
    });
  }
}
