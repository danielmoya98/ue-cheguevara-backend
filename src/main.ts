import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'; // 💡 Corrección en la importación

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Asegúrate de importar cookie-parser correctamente (dependiendo de tu tsconfig)
  app.use(cookieParser());
  app.use(helmet());

  // ==================================================
  // 🔥 SEGURIDAD Y CORS (Configuración de Hierro)
  // ==================================================
  
  // 1. Extraemos los orígenes permitidos fuera de la función de callback
  // para mayor claridad y rendimiento (no se recalcula en cada request).
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://192.168.1.11:3000',
    'http://192.168.1.11:3001',
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(...process.env.FRONTEND_URL.split(','));
  }

  app.enableCors({
    origin: (origin, callback) => {
      // 💡 CORRECCIÓN CRÍTICA:
      // Si no hay origen (Postman, curl, Server-to-Server, o la inicialización de Socket.IO en algunos casos),
      // o si el origen está en nuestra lista blanca, permitimos la conexión pasando `true`.
      // NestJS automáticamente establecerá 'Access-Control-Allow-Origin: <el_origen_exacto>'
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); 
      } else {
        logger.warn(`Intento de conexión bloqueado por CORS desde origen: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Vital para enviar cookies JWT y para Socket.IO
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
  logger.log(`🛡️ Orígenes CORS permitidos: ${allowedOrigins.join(', ')}`);
}
bootstrap();