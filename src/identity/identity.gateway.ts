import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'], // Añade aquí tu dominio de Vercel cuando lo subas
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class IdentityGateway {
  @WebSocketServer()
  server: Server;

  notifyExportComplete(academicYearId: string, fileName: string) {
    this.server.emit(`carnets-ready-${academicYearId}`, {
      message: '¡Tu lote de carnets está listo para impresión!',
      fileName: fileName,
    });
  }
}