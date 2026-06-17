import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Only these fields may be applied from a business owner's change request. */
const SAFE_PAYLOAD_FIELDS = [
  'name', 'description', 'categories', 'services', 'tags',
  'phone', 'email', 'website', 'address', 'city', 'state', 'zip',
  'isBlackAmericanOwned', 'logoUrl', 'coverImageUrl', 'yearEstablished',
  'serviceArea', 'bookingLink', 'facebook', 'instagram', 'linkedin',
  'tiktok', 'youtube', 'isOnlineOnly', 'isMobile', 'appointmentRequired',
  'deliveryAvailable', 'acceptingNewCustomers', 'businessHours',
] as const;

function withUrlProtocol(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

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
        data: (() => {
          const raw = request.payload as Record<string, unknown>;
          const safe: Record<string, unknown> = { updatedAt: new Date() };
          const urlFields = new Set([
            'website',
            'logoUrl',
            'coverImageUrl',
            'bookingLink',
            'facebook',
            'instagram',
            'linkedin',
            'tiktok',
            'youtube',
          ]);
          for (const field of SAFE_PAYLOAD_FIELDS) {
            if (field in raw) {
              safe[field] = urlFields.has(field) ? withUrlProtocol(raw[field]) : raw[field];
            }
          }
          return safe;
        })(),
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
