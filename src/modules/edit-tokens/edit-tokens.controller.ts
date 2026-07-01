import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';
import { SubmitEditSessionDto } from './dto/submit-edit-session.dto';
import { EditTokensService } from './edit-tokens.service';

@Controller()
export class EditTokensController {
  constructor(private readonly editTokensService: EditTokensService) {}

  @Get('edit-links/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateToken(@Param('token') token: string) {
    return this.editTokensService.validateAndGetBusiness(token);
  }

  @Post('edit-links/:token/submit')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submitEdit(@Param('token') token: string, @Body() dto: SubmitEditTokenDto) {
    return this.editTokensService.submit(token, dto);
  }

  @Get('businesses/edit-session')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateEditSession(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Token is required.');
    }
    return this.editTokensService.validateAndGetBusiness(token);
  }

  @Post('businesses/edit-session')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submitEditSession(@Body() dto: SubmitEditSessionDto) {
    return this.editTokensService.submit(dto.token, { payload: dto.updates });
  }
}
