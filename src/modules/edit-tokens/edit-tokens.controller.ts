import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';
import { EditTokensService } from './edit-tokens.service';

@Controller('edit-links')
export class EditTokensController {
  constructor(private readonly editTokensService: EditTokensService) {}

  @Get(':token')
  validateToken(@Param('token') token: string) {
    return this.editTokensService.validateAndGetBusiness(token);
  }

  @Post(':token/submit')
  submitEdit(@Param('token') token: string, @Body() dto: SubmitEditTokenDto) {
    return this.editTokensService.submit(token, dto);
  }
}
