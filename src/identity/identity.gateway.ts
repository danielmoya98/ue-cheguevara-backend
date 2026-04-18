import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
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