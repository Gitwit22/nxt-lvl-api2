import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PartitionService } from './common/services/partition.service';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

function isOriginAllowed(requestOrigin: string, configuredOrigins: string[]): boolean {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

  return configuredOrigins.some((configuredOrigin) => {
    const normalizedConfiguredOrigin = normalizeOrigin(configuredOrigin);

    if (normalizedConfiguredOrigin === '*') {
      return true;
    }

    // Support wildcard subdomain rules such as https://*.pages.dev
    if (normalizedConfiguredOrigin.includes('*')) {
      const pattern = normalizedConfiguredOrigin
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(normalizedRequestOrigin);
    }

    return normalizedConfiguredOrigin === normalizedRequestOrigin;
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const partitionService = app.get(PartitionService);

  // Security headers (helmet)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  const corsOrigins = [
    ...(process.env.CORS_ORIGIN ?? '').split(','),
    ...partitionService.getPartitions().map((partition) => partition.appUrl),
  ]
    .map((origin) => origin.trim())
    .filter((origin, index, origins) => origin.length > 0 && origins.indexOf(origin) === index);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!requestOrigin || corsOrigins.length === 0) {
        callback(null, true);
        return;
      }

      callback(null, isOriginAllowed(requestOrigin, corsOrigins));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Partition'],
  });

  const exactCookieOrigins = corsOrigins
    .filter((origin) => origin !== '*' && !origin.includes('*'))
    .map(normalizeOrigin);
  const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const hasAuthCookie = Object.keys(request.cookies ?? {}).some((name) =>
      name.includes('clientflow_session') || name.includes('clientflow_refresh'),
    );
    if (!hasAuthCookie || !stateChangingMethods.has(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    if (!origin || !exactCookieOrigins.includes(normalizeOrigin(origin))) {
      response.status(403).json({ message: 'Origin is not allowed for this request.' });
      return;
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const programPartition = partitionService.getDefaultPartition();
  const config = new DocumentBuilder()
    .setTitle(`${programPartition.appName} API 2`)
    .setDescription(`Dedicated API 2 partition for ${programPartition.customerName}.`)
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
