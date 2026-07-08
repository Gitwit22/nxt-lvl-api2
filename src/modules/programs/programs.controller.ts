import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { BusinessesService } from '../businesses/businesses.service';
import { UpsertLaunchpadStateDto } from './dto/upsert-launchpad-state.dto';

@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly programsService: ProgramsService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get()
  getPrograms() {
    return this.programsService.listPrograms();
  }

  @Get('launchpad/state')
  getLaunchpadState() {
    return this.programsService.getLaunchpadState();
  }

  @Post('launchpad/state')
  upsertLaunchpadState(@Body() dto: UpsertLaunchpadStateDto) {
    return this.programsService.upsertLaunchpadState(dto);
  }

  @UseGuards(AdminJwtGuard)
  @Post()
  createProgram(@Body() dto: CreateProgramDto) {
    return this.programsService.createProgram(dto);
  }

  @Get(':programSlug/businesses')
  getBusinessesByProgram(@Param('programSlug') programSlug: string) {
    return this.businessesService.listPublishedByProgramSlug(programSlug);
  }

  @Get(':programSlug/businesses/:businessSlug')
  getBusinessBySlug(@Param('programSlug') programSlug: string, @Param('businessSlug') businessSlug: string) {
    return this.businessesService.getPublishedBySlug(programSlug, businessSlug);
  }

  @Get(':programSlug/categories')
  getCategories(@Param('programSlug') programSlug: string) {
    return this.businessesService.listCategoriesByProgramSlug(programSlug);
  }
}
