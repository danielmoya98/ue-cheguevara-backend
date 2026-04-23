import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('CORS');

export const getCorsConfig = (): CorsOptions => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://192.168.1.11:3000',
    'http://192.168.1.11:3001',
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(...process.env.FRONTEND_URL.split(','));
  }

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Bloqueado por CORS: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['set-cookie'],
  };
};