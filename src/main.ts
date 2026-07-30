import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const allowedOrigins = configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  app.enableCors({
    origin: allowedOrigins.split(',').map(o => o.trim()),
    credentials: true,
  });

  // Serve uploaded files from /uploads
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  app.useGlobalPipes(new ValidationPipe());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
