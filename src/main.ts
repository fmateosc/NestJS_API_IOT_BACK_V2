// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { CORS } from './config/cors.js';
import { readFileSync } from 'fs';
import express from 'express';
import * as https from 'https';
import { AllExceptionFilter } from './common/filters/http-exception.filter.js';
import { TimeOutInterceptor } from './common/interceptors/timeout.interceptor.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // prefix - Moved before Swagger to ensure correct pathing
  app.setGlobalPrefix('api/v1');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Irrigation IoT API')
    .setDescription(
      'Professional API documentation for the Smart Irrigation System (SaaS).',
    )
    .setVersion('1.0.0')
    .addServer('/api/v1', 'Default API version')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/v1/docs', app, document);

  // filter error messages
  app.useGlobalFilters(new AllExceptionFilter());

  // global interceptors
  app.useGlobalInterceptors(new TimeOutInterceptor());

  // Trust Proxy (Essential for correctly detecting public URLs behind Apache/Nginx)
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  const logger = new Logger('Bootstrap');

  const HTTP_PORT = process.env.HTTP_PORT || 3000;
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

  // global  validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // cors
  app.enableCors(CORS);

  // http
  app.listen(HTTP_PORT, () => {
    logger.log(`🚀 HTTP server started on port: ${HTTP_PORT}`);
  });

  // https
  const httpsOptions = {
    key: readFileSync('certs/key.pem'),
    cert: readFileSync('certs/cert.pem'),
    ca: readFileSync('certs/cacert.pem'),
  };

  const expressApp = express();
  expressApp.use(app.getHttpAdapter().getInstance());

  https.createServer(httpsOptions, expressApp).listen(HTTPS_PORT, () => {
    logger.log(`🔒 HTTPS server started on port: ${HTTPS_PORT}`);
  });
}
await bootstrap();
