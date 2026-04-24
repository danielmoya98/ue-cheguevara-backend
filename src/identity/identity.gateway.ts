import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { getCorsConfig } from '../common/configs/cors.config';
@WebSocketGateway({
  cors: {
    origin: getCorsConfig().origin,
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