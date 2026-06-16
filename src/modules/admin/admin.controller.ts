import { Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('programs/:programId/businesses')
  getProgramBusinesses(@Param('programId') programId: string) {
    return this.prisma.business.findMany({
      where: { programId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Patch('businesses/:businessId')
  async touchBusiness(@Param('businessId') businessId: string) {
    return this.prisma.business.update({
      where: { id: businessId },
      data: { updatedAt: new Date() },
    });
  }

  @Delete('businesses/:businessId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBusiness(@Param('businessId') businessId: string) {
    await this.prisma.business.delete({ where: { id: businessId } });
  }

  @Post('businesses/:businessId/generate-edit-link')
  async generateEditLink(@Param('businessId') businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    await this.prisma.businessEditToken.create({
      data: { businessId, tokenHash, expiresAt },
    });
    if (business.email) {
      await this.notifications.sendEditLink({
        to: business.email,
        businessName: business.name,
        token,
        expiresAt,
      }).catch(() => undefined);
    }
    return { token, expiresAt };
  }
}
