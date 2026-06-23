import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClipMagicController } from './clip-magic.controller';
import { ClipMagicService } from './clip-magic.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClipMagicController],
  providers: [ClipMagicService],
})
export class ClipMagicModule {}
