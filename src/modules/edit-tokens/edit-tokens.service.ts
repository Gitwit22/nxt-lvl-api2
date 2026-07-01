import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';

@Injectable()
export class EditTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async validateAndGetBusiness(token: string) {
    const editToken = await this.getValidEditToken(token);
    return editToken.business;
  }

  async submit(token: string, dto: SubmitEditTokenDto) {
    const editToken = await this.getValidEditToken(token);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.businessEditToken.update({
        where: { id: editToken.id },
        data: { usedAt: new Date() },
      });

      return tx.businessChangeRequest.create({
        data: {
          businessId: editToken.businessId,
          payload: dto.payload as Prisma.InputJsonValue,
          requestedByEmail:
            editToken.requestedByEmail ??
            editToken.requestedForEmail ??
            editToken.business.email ??
            undefined,
        },
      });
    });

    const notifyEmail =
      editToken.requestedByEmail ??
      editToken.requestedForEmail ??
      editToken.business.email ??
      undefined;

    if (notifyEmail) {
      await this.notifications
        .sendUpdateRequestSubmitted({
          to: notifyEmail,
          businessName: editToken.business.name,
        })
        .catch(() => undefined);
    }

    return created;
  }

  private async getValidEditToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const editToken = await this.prisma.businessEditToken.findFirst({
      where: { tokenHash },
      include: { business: true },
    });

    if (!editToken || editToken.purpose !== 'BUSINESS_UPDATE') {
      throw new NotFoundException('Edit link not found.');
    }
    if (editToken.usedAt) {
      throw new UnauthorizedException('Edit link already used.');
    }
    if (editToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Edit link expired.');
    }

    return editToken;
  }
}
