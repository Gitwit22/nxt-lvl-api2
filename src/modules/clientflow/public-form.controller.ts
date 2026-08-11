import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicFormService } from './public-form.service';
import { SubmitPublicFormDto } from './dto/submit-public-form.dto';

@Controller('public/form')
export class PublicFormController {
  constructor(private readonly svc: PublicFormService) {}

  @Get(':token')
  getForm(@Param('token') token: string) {
    return this.svc.getPublicForm(token);
  }

  @Post(':token/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submitForm(@Param('token') token: string, @Body() dto: SubmitPublicFormDto) {
    return this.svc.submitPublicForm(token, dto);
  }
}
