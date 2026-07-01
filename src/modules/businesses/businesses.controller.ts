import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { RequestEditLinkDto } from './dto/request-edit-link.dto';
import { SuggestUpdateDto } from './dto/suggest-update.dto';

@Controller()
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @UseGuards(AdminJwtGuard)
  @Post('businesses')
  createBusiness(@Body() dto: CreateBusinessDto) {
    return this.businessesService.createBusiness(dto);
  }

  @Post('businesses/:businessSlug/suggest-update')
  suggestUpdate(@Param('businessSlug') businessSlug: string, @Body() dto: SuggestUpdateDto) {
    return this.businessesService.suggestUpdate(businessSlug, dto);
  }

  @Post('businesses/:businessRef/request-edit-link')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestEditLink(
    @Param('businessRef') businessRef: string,
    @Body() dto: RequestEditLinkDto,
    @Req() req: Request,
  ) {
    return this.businessesService.requestEditLink(businessRef, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
