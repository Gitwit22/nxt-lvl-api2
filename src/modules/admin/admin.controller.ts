import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';

@Controller('admin')
@UseGuards(AdminJwtGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

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
}
