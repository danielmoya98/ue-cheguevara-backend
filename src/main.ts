import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // ==================================================
  // 1. SEGURIDAD
  // ==================================================
  app.use(cookieParser());
  app.use(helmet());

  // 🔥 IMPORTANTE PARA COOKIES EN PRODUCCIÓN (Render)
  app.set('trust proxy', 1);

  // ==================================================
  // 2. CORS DINÁMICO (PRODUCCIÓN + DEV)
  // ==================================================
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL?.split(',') || []
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

  // ==================================================
  // 3. VERSIONADO
  // ==================================================
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ==================================================
  // 4. INTERCEPTORS / FILTERS
  // ==================================================
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // ==================================================
  // 5. VALIDACIÓN
  // ==================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ==================================================
  // 6. SWAGGER (SOLO EN DEV)
  // ==================================================
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('UECG Core API')
      .setDescription('Motor de datos estandarizado para el Sistema RUE/SIE')
      .setVersion('1.0.0')
      .addCookieAuth('uecg_access_token')
      .addTag('Autenticación')
      .addTag('Usuarios')
      .addTag('Institución (RUE)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'UECG API Docs',
    });
  }

  // ==================================================
  // 7. SERVER
  // ==================================================
  const port = process.env.PORT || 4000;

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 API corriendo en puerto ${port}`);
  logger.log(`🌍 Entorno: ${process.env.NODE_ENV}`);
}

bootstrap();
