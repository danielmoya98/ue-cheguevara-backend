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

  // ==================================================
  // 1. SEGURIDAD: Inicializar Cookie Parser y Helmet
  // ==================================================
  app.use(cookieParser());
  app.use(helmet());

  // ==================================================
  // 2. SEGURIDAD: CORS (Cross-Origin Resource Sharing)
  // ==================================================
  // 🔥 CAMBIO CRÍTICO PARA FLUTTER MOBILE:
  // En desarrollo, permitimos peticiones de cualquier origen (el celular).
  // En producción, usarás process.env.FRONTEND_URL
  app.enableCors({
    // Definimos una lista con los orígenes exactos de tu Next.js
    // (Incluyo el 3001 por si se te vuelve a bloquear el puerto 3000)
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.1.11:3000',
      'http://192.168.1.11:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // 🔥 ESTO AHORA SÍ FUNCIONARÁ Y ES VITAL PARA EL LOGIN
  });
  // ==================================================
  // 3. ARQUITECTURA: Versionado de API
  // ==================================================
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ==================================================
  // 4. ESTÁNDARES: Interceptores y Filtros
  // ==================================================
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // ==================================================
  // 5. SEGURIDAD: Validación Global de DTOs
  // ==================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ==================================================
  // 6. DOCUMENTACIÓN: Configuración de Swagger
  // ==================================================
  const config = new DocumentBuilder()
    .setTitle('UECG Core API')
    .setDescription('Motor de datos estandarizado para el Sistema RUE/SIE')
    .setVersion('1.0.0')
    .addCookieAuth('uecg_access_token')
    .addTag('Autenticación', 'Endpoints de login y seguridad')
    .addTag('Usuarios', 'Gestión de personal administrativo y docente')
    .addTag('Institución (RUE)', 'Gestión del colegio')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'UECG API Docs',
  });

  const port = process.env.PORT || 4000;

  // ==================================================
  // 7. INICIO DEL SERVIDOR (ESCUCHA EN TODA LA RED)
  // ==================================================
  // 🔥 CAMBIO CRÍTICO: '0.0.0.0' expone la API a tu red Wi-Fi
  await app.listen(port, '0.0.0.0');

  // Imprimimos en consola las URLs reales
  // Usamos tu IP (192.168.1.11) en el log para que la puedas copiar directo a Flutter
  logger.log(
    `🚀 UECG API corriendo exitosamente en la red local: http://192.168.1.11:${port}/api/v1`,
  );
  logger.log(
    `📚 Documentación Swagger disponible en: http://192.168.1.11:${port}/api/docs`,
  );
}
bootstrap();
