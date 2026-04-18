import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'], // Añade aquí tu dominio de Vercel cuando lo subas
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class TimetablesGateway {
  @WebSocketServer()
  server: Server;

  notifyExportComplete(academicYearId: string, fileName: string) {
    // Emitimos un evento que el frontend va a escuchar
    this.server.emit(`export-ready-${academicYearId}`, {
      message: '¡Tus horarios masivos están listos!',
      fileName: fileName,
    });
  }
}
