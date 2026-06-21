import { Module } from '@nestjs/common';
import { CinemaStudioController } from './cinema-studio.controller';
import { CinemaStudioService } from './cinema-studio.service';

@Module({
  controllers: [CinemaStudioController],
  providers: [CinemaStudioService],
  exports: [CinemaStudioService],
})
export class CinemaStudioModule {}
