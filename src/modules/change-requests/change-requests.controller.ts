import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { ChangeRequestsService } from './change-requests.service';

@Controller('admin/change-requests')
@UseGuards(AdminJwtGuard)
export class ChangeRequestsController {
  constructor(private readonly changeRequestsService: ChangeRequestsService) {}

  @Get()
  listPending() {
    return this.changeRequestsService.listPending();
  }

  @Post(':requestId/approve')
  approve(@Param('requestId') requestId: string, @Req() req: Request) {
    const adminId = String(req.headers['x-admin-id'] ?? '');
    return this.changeRequestsService.approve(requestId, adminId);
  }

  @Post(':requestId/reject')
  reject(@Param('requestId') requestId: string, @Req() req: Request) {
    const adminId = String(req.headers['x-admin-id'] ?? '');
    return this.changeRequestsService.reject(requestId, adminId);
  }
}
