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

  // ==================================================
  // 🔥 SEGURIDAD Y CORS (Configuración Dinámica)
  // ==================================================
  app.enableCors({
    origin: function (origin, callback) {
      // 1. Definimos los orígenes base (desarrollo y red local)
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://192.168.1.11:3000',
        'http://192.168.1.11:3001',
      ];

      // 2. Si existe la variable en Render, la inyectamos a la lista
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(...process.env.FRONTEND_URL.split(','));
      }

      // 3. Lógica dinámica:
      // Si no hay origen (Postman/Móvil) o el origen está en nuestra lista,
      // le devolvemos ESE origen exacto al navegador para cumplir con 'credentials: true'
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['set-cookie'],
  });

  // ==================================================
  // ARQUITECTURA Y ESTÁNDARES
  // ==================================================
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

  // ==================================================
  // DOCUMENTACIÓN SWAGGER
  // ==================================================
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

  // ==================================================
  // INICIO DEL SERVIDOR
  // ==================================================
  const port = process.env.PORT || 4000;

  // 0.0.0.0 es obligatorio en Render para exponer el servicio correctamente
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 UECG API corriendo en el puerto: ${port}`);
  logger.log(`📚 Entorno: ${process.env.NODE_ENV || 'desarrollo'}`);
}
bootstrap();
