import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

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

  // Security headers (helmet)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

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
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  const config = new DocumentBuilder()
    .setTitle('NXT LVL API 2')
    .setDescription('Program-based API for multi-program operations')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap();
