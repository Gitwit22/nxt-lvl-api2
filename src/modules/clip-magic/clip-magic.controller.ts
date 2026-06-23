import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ClipMagicService } from './clip-magic.service';
import { UpsertClipMagicStateDto } from './dto/upsert-clip-magic-state.dto';

@Controller('clip-magic')
export class ClipMagicController {
  constructor(private readonly clipMagicService: ClipMagicService) {}

  @Get('state/:workspaceId')
  getState(@Param('workspaceId') workspaceId: string) {
    return this.clipMagicService.getState(workspaceId);
  }

  @Put('state/:workspaceId')
  upsertState(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpsertClipMagicStateDto,
  ) {
    return this.clipMagicService.upsertState(workspaceId, dto.state);
  }
}
