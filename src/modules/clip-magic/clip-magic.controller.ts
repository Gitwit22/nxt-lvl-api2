import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ClipMagicService } from './clip-magic.service';
import { UpsertClipMagicStateDto } from './dto/upsert-clip-magic-state.dto';
import { UploadMusicFileDto } from './dto/upload-music-file.dto';

@Controller('clip-magic')
export class ClipMagicController {
  constructor(private readonly clipMagicService: ClipMagicService) {}

  // State endpoints
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

  // Music file endpoints
  @Post('music/upload/:workspaceId')
  uploadMusicFile(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UploadMusicFileDto,
  ) {
    return this.clipMagicService.uploadMusicFile(workspaceId, dto);
  }

  @Get('music/:workspaceId/:trackId')
  getMusicFile(
    @Param('workspaceId') workspaceId: string,
    @Param('trackId') trackId: string,
  ) {
    return this.clipMagicService.getMusicFile(workspaceId, trackId);
  }

  @Get('music/:workspaceId')
  getMusicFiles(@Param('workspaceId') workspaceId: string) {
    return this.clipMagicService.getMusicFiles(workspaceId);
  }

  @Delete('music/:workspaceId/:trackId')
  deleteMusicFile(
    @Param('workspaceId') workspaceId: string,
    @Param('trackId') trackId: string,
  ) {
    return this.clipMagicService.deleteMusicFile(workspaceId, trackId);
  }
}
