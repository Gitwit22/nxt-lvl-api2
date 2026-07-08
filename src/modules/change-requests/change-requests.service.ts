import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Only these fields may be applied from a business owner's change request. */
const SAFE_PAYLOAD_FIELDS = [
  'name', 'description', 'categories', 'services', 'tags',
  'phone', 'email', 'website', 'address', 'city', 'state', 'zip',
  'isBlackAmericanOwned', 'logoUrl', 'coverImageUrl', 'photoUrls', 'yearEstablished',
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  listPending() {
    return this.prisma.businessChangeRequest.findMany({
      where: { status: 'pending_review' },
      orderBy: { createdAt: 'desc' },
      include: { business: true },
    });
  }

  async approve(requestId: string, adminId: string) {
    const request = await this.prisma.businessChangeRequest.findUnique({
      where: { id: requestId },
      include: { business: true },
    });
    if (!request) {
      throw new NotFoundException('Change request not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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
              if (field === 'photoUrls' && Array.isArray(raw[field])) {
                safe[field] = (raw[field] as unknown[])
                  .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                  .map((item) => String(withUrlProtocol(item)));
                continue;
              }

              safe[field] = urlFields.has(field) ? withUrlProtocol(raw[field]) : raw[field];
            }
          }
          return safe;
        })(),
      });

      return tx.businessChangeRequest.findUnique({ where: { id: requestId } });
    });

    const notifyEmail = request.requestedByEmail ?? request.business.email ?? undefined;
    if (notifyEmail) {
      await this.notifications
        .sendUpdateRequestReviewed({
          to: notifyEmail,
          businessName: request.business.name,
          status: 'approved',
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async reject(requestId: string, adminId: string) {
    const request = await this.prisma.businessChangeRequest.findUnique({
      where: { id: requestId },
      include: { business: true },
    });
    if (!request) {
      throw new NotFoundException('Change request not found.');
    }

    const updated = await this.prisma.businessChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
      },
    });

    const notifyEmail = request.requestedByEmail ?? request.business.email ?? undefined;
    if (notifyEmail) {
      await this.notifications
        .sendUpdateRequestReviewed({
          to: notifyEmail,
          businessName: request.business.name,
          status: 'rejected',
        })
        .catch(() => undefined);
    }

    return updated;
  }
}
