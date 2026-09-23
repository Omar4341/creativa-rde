import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Suppress stack traces in logs in production — they are still caught by the filter
    logger:
      process.env['NODE_ENV'] === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const config = app.get(AppConfigService);

  // ─── Security: Helmet ────────────────────────────────────────────────────
  // Sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // ─── Security: CORS ──────────────────────────────────────────────────────
  // Origins are read from ALLOWED_ORIGINS env variable (comma-separated).
  // Never use '*' in production — Presenter and Admin are served from known origins.
  app.enableCors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ─── Global Validation Pipe ───────────────────────────────────────────────
  // whitelist: strips unknown properties from request body
  // forbidNonWhitelisted: throws 400 if unknown properties are present
  // transform: auto-converts primitive types (e.g. string to number for @Type)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // Require explicit @Type() decorators
      },
    }),
  );

  // ─── Global Exception Filter ──────────────────────────────────────────────
  // Converts all exceptions to the approved error envelope:
  // { success: false, error: { code, message, details } }
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Start server ─────────────────────────────────────────────────────────
  const port = config.port;
  await app.listen(port);

  if (!config.isProduction) {
    console.log(`Application running on: http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  }
}

await bootstrap();
