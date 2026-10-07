import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { SuiteCatalogController } from './suite-catalog.controller';
import { SuiteCatalogService } from './suite-catalog.service';

@Module({
  imports: [FilesModule],
  controllers: [SuiteCatalogController],
  providers: [SuiteCatalogService],
})
export class SuiteCatalogModule {}
