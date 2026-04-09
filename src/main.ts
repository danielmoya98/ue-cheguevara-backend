import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common'; // <-- Agregamos VersioningType y Logger
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// Importamos nuestros nuevos filtros e interceptores estandarizados
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap'); // <-- Logger para la consola (Punto 12)

  // ==================================================
  // 1. SEGURIDAD: Inicializar Cookie Parser y Helmet
  // ==================================================
  app.use(cookieParser());
  app.use(helmet());

  // ==================================================
  // 2. SEGURIDAD: CORS (Cross-Origin Resource Sharing)
  // ==================================================
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ==================================================
  // 3. ARQUITECTURA: Versionado de API (Punto 1)
  // ==================================================
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // Esto hará que todas las rutas sean /api/v1/...
  });

  // ==================================================
  // 4. ESTÁNDARES: Interceptores y Filtros (Puntos 3, 13)
  // ==================================================
  // Envuelve todas las respuestas exitosas en { success: true, data: ... }
  app.useGlobalInterceptors(new ResponseInterceptor());
  // Atrapa todos los errores y los formatea a { success: false, error: ... }
  app.useGlobalFilters(new AllExceptionsFilter());

  // ==================================================
  // 5. SEGURIDAD: Validación Global de DTOs (Punto 4)
  // ==================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Vital: convierte "1" a 1 en las paginaciones automáticamente
    }),
  );

  // ==================================================
  // 6. DOCUMENTACIÓN: Configuración de Swagger (Punto 11)
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
  await app.listen(port);

  // Imprimimos en consola dónde está corriendo nuestra API versionada
  logger.log(
    `🚀 UECG API corriendo exitosamente en: http://localhost:${port}/api/v1`,
  );
  logger.log(
    `📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
