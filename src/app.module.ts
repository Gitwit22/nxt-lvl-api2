import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PartitionMiddleware } from './common/middleware/partition.middleware';
import { PartitionModule } from './common/partition.module';
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
import { ProgramsModule } from './modules/programs/programs.module';
import { CinemaStudioModule } from './modules/cinema-studio/cinema-studio.module';
import { StudioCoreModule } from './modules/studio-core/studio-core.module';
import { ClipMagicModule } from './modules/clip-magic/clip-magic.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ClientflowModule } from './modules/clientflow/clientflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => environmentSchema.parse(config),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PartitionModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    ProgramsModule,
    CinemaStudioModule,
    StudioCoreModule,
    ClipMagicModule,
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
    OrganizationsModule,
    ClientflowModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PartitionMiddleware).forRoutes('*');
  }
}
