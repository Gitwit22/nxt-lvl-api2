import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { StudioCoreService } from './studio-core.service';
import { UpsertStudioCoreStateDto } from './dto/upsert-studio-core-state.dto';

@Controller('studio-core')
export class StudioCoreController {
  constructor(private readonly studioCoreService: StudioCoreService) {}

  @Get('state/:workspaceId')
  getState(@Param('workspaceId') workspaceId: string) {
    return this.studioCoreService.getState(workspaceId);
  }

  @Put('state/:workspaceId')
  upsertState(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpsertStudioCoreStateDto,
  ) {
    return this.studioCoreService.upsertState(workspaceId, dto.state);
  }
}
