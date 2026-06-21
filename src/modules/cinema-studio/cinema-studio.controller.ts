import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CinemaStudioService } from './cinema-studio.service';
import { UpsertCinemaStateDto } from './dto/upsert-cinema-state.dto';

@Controller('cinema-studio')
export class CinemaStudioController {
  constructor(private readonly cinemaStudioService: CinemaStudioService) {}

  @Get('state/:workspaceId')
  getState(@Param('workspaceId') workspaceId: string) {
    return this.cinemaStudioService.getState(workspaceId);
  }

  @Put('state/:workspaceId')
  upsertState(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpsertCinemaStateDto,
  ) {
    return this.cinemaStudioService.upsertState(workspaceId, dto.state);
  }
}
