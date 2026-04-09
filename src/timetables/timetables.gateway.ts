import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
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
