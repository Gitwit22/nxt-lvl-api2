import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
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

  @Post('businesses/:businessSlug/request-edit-link')
  requestEditLink(@Param('businessSlug') businessSlug: string) {
    return this.businessesService.requestEditLink(businessSlug);
  }
}
