import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/env';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { BusinessSubmissionsModule } from './modules/business-submissions/business-submissions.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ChangeRequestsModule } from './modules/change-requests/change-requests.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { EditTokensModule } from './modules/edit-tokens/edit-tokens.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { CinemaStudioModule } from './modules/cinema-studio/cinema-studio.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => environmentSchema.parse(config),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    ProgramsModule,
    CinemaStudioModule,
    BusinessesModule,
    ContactsModule,
    CategoriesModule,
    BusinessSubmissionsModule,
    ChangeRequestsModule,
    EditTokensModule,
    FilesModule,
    NotificationsModule,
    AdminModule,
    AuditLogModule,
  ],
})
export class AppModule {}
