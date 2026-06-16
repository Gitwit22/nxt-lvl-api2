import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

  // Fetch all businesses (all statuses) by program slug — used by admin dashboard
  @Get('programs/by-slug/:programSlug/businesses')
  async getProgramBusinessesBySlug(@Param('programSlug') programSlug: string) {
    const program = await this.prisma.program.findFirst({ where: { slug: programSlug } });
    if (!program) throw new NotFoundException('Program not found.');
    return this.prisma.business.findMany({
      where: { programId: program.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('programs/:programId/businesses')
  getProgramBusinesses(@Param('programId') programId: string) {
    return this.prisma.business.findMany({
      where: { programId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Patch('businesses/:businessId')
  async updateBusiness(
    @Param('businessId') businessId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const allowed = [
      'name', 'description', 'categories', 'services', 'tags',
      'phone', 'email', 'website', 'address', 'city', 'state', 'zip',
      'isBlackAmericanOwned', 'logoUrl', 'coverImageUrl', 'yearEstablished',
      'serviceArea', 'bookingLink', 'facebook', 'instagram', 'linkedin',
      'tiktok', 'youtube', 'isOnlineOnly', 'isMobile', 'appointmentRequired',
      'deliveryAvailable', 'acceptingNewCustomers', 'businessHours',
    ];
    const data: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    return this.prisma.business.update({
      where: { id: businessId },
      data,
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
