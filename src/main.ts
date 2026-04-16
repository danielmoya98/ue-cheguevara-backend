import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser());
  app.use(helmet());

  // 🔥 ORIGEN DINÁMICO: Lee desde la variable de entorno o usa localhost en desarrollo
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://192.168.1.11:3000',
        'http://192.168.1.11:3001',
      ];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('UECG Core API')
    .setDescription('Motor de datos estandarizado para el Sistema RUE/SIE')
    .setVersion('1.0.0')
    .addCookieAuth('uecg_access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'UECG API Docs',
  });

  // Render inyecta dinámicamente el puerto
  const port = process.env.PORT || 4000;

  // 0.0.0.0 es obligatorio en Render para exponer el servicio correctamente
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 UECG API corriendo en el puerto: ${port}`);
  logger.log(`📚 Entorno: ${process.env.NODE_ENV || 'desarrollo'}`);
}
bootstrap();
