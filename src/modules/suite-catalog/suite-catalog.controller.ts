import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { OptionalAdminJwtGuard } from '../../common/guards/optional-admin-jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateCatalogProgramDto, UpdateCatalogProgramDto } from './dto/catalog-program.dto';
import { ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_BYTES } from './logo-image';
import { SuiteCatalogService } from './suite-catalog.service';

/**
 * Program catalog for the NXT LVL Hub (X-App-Partition: nxt-lvl-suites).
 * Reads are public (hidden/admin-only entries only for platform admins); writes are super_admin only.
 */
@Controller('suite')
export class SuiteCatalogController {
  constructor(private readonly catalog: SuiteCatalogService) {}

  @Get('programs')
  @UseGuards(OptionalAdminJwtGuard)
  list() {
    return this.catalog.list();
  }

  @Get('programs/:id')
  @UseGuards(OptionalAdminJwtGuard)
  get(@Param('id') id: string) {
    return this.catalog.get(id);
  }

  @Post('programs')
  @UseGuards(AdminJwtGuard, SuperAdminGuard)
  create(@Body() dto: CreateCatalogProgramDto) {
    return this.catalog.create(dto);
  }

  @Put('programs/:id')
  @UseGuards(AdminJwtGuard, SuperAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCatalogProgramDto) {
    return this.catalog.update(id, dto);
  }

  @Delete('programs/:id')
  @UseGuards(AdminJwtGuard, SuperAdminGuard)
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }

  @Post('uploads/logo')
  @UseGuards(AdminJwtGuard, SuperAdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException('Only PNG, JPG, GIF, or WEBP images are supported.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.catalog.uploadLogo(file);
  }
}
