import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadMusicFileDto, MusicFileResponseDto } from './dto/upload-music-file.dto';

@Injectable()
export class ClipMagicService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(workspaceId: string) {
    return this.prisma.clipMagicState.findUnique({
      where: { workspaceId },
      select: {
        workspaceId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertState(workspaceId: string, state: Record<string, unknown>) {
    return this.prisma.clipMagicState.upsert({
      where: { workspaceId },
      update: {
        state: state as Prisma.InputJsonValue,
      },
      create: {
        workspaceId,
        state: state as Prisma.InputJsonValue,
      },
      select: {
        workspaceId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async uploadMusicFile(workspaceId: string, dto: UploadMusicFileDto): Promise<MusicFileResponseDto> {
    // Ensure the workspace state exists
    await this.prisma.clipMagicState.upsert({
      where: { workspaceId },
      update: {},
      create: {
        workspaceId,
        state: {},
      },
    });

    const musicFile = await this.prisma.clipMagicMusicFile.upsert({
      where: {
        workspaceId_trackId: {
          workspaceId,
          trackId: dto.trackId,
        },
      },
      update: {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        duration: dto.duration ?? 150,
        bpm: dto.bpm ?? 100,
        mood: dto.mood ?? 'Custom',
        dataUrl: dto.dataUrl,
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        trackId: dto.trackId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        duration: dto.duration ?? 150,
        bpm: dto.bpm ?? 100,
        mood: dto.mood ?? 'Custom',
        dataUrl: dto.dataUrl,
      },
    });

    return this.musicFileToResponse(musicFile, true);
  }

  async getMusicFile(workspaceId: string, trackId: string): Promise<MusicFileResponseDto | null> {
    const musicFile = await this.prisma.clipMagicMusicFile.findUnique({
      where: {
        workspaceId_trackId: {
          workspaceId,
          trackId,
        },
      },
    });

    return musicFile ? this.musicFileToResponse(musicFile, true) : null;
  }

  async getMusicFiles(workspaceId: string): Promise<MusicFileResponseDto[]> {
    const musicFiles = await this.prisma.clipMagicMusicFile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return musicFiles.map((file) => this.musicFileToResponse(file, false));
  }

  async deleteMusicFile(workspaceId: string, trackId: string): Promise<boolean> {
    const result = await this.prisma.clipMagicMusicFile.delete({
      where: {
        workspaceId_trackId: {
          workspaceId,
          trackId,
        },
      },
    }).catch(() => null);

    return !!result;
  }

  private musicFileToResponse(file: any, includeDataUrl: boolean): MusicFileResponseDto {
    const response: MusicFileResponseDto = {
      id: file.id,
      trackId: file.trackId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      duration: file.duration,
      bpm: file.bpm,
      mood: file.mood,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };

    if (includeDataUrl) {
      response.dataUrl = file.dataUrl;
    }

    return response;
  }
}
