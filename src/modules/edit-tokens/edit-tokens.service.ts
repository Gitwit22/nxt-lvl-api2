import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';

@Injectable()
export class EditTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(token: string, dto: SubmitEditTokenDto) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const editToken = await this.prisma.businessEditToken.findFirst({
      where: {
        tokenHash,
      },
      include: {
        business: true,
      },
    });

    if (!editToken) {
      throw new NotFoundException('Edit token not found.');
    }

    if (editToken.usedAt) {
      throw new UnauthorizedException('Edit token already used.');
    }

    if (editToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Edit token expired.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.businessEditToken.update({
        where: { id: editToken.id },
        data: { usedAt: new Date() },
      });

      return tx.businessChangeRequest.create({
        data: {
          businessId: editToken.businessId,
          payload: dto.payload as Prisma.InputJsonValue,
          requestedByEmail: editToken.business.email ?? undefined,
        },
      });
    });
  }
}
