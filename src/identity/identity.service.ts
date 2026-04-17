import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class IdentityService {
  // 🔥 Usa una clave secreta desde tu .env en producción
  private readonly SECRET_KEY =
    process.env.QR_SECRET || 'UECG_SECRET_2026_BOLIVIA';

  /**
   * Genera un token firmado para el QR.
   * Esto evita que alguien cree su propio QR manualmente.
   */
  generateSignedToken(studentId: string): string {
    const hash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(studentId)
      .digest('hex')
      .slice(0, 10); // Solo tomamos 10 caracteres para que el QR no sea muy denso

    return `${studentId}:${hash}`;
  }

  /**
   * Valida si un token de QR es legítimo
   */
  validateToken(token: string): string | null {
    const [id, hash] = token.split(':');
    if (!id || !hash) return null;

    const expectedHash = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(id)
      .digest('hex')
      .slice(0, 10);

    return hash === expectedHash ? id : null;
  }

  /**
   * Genera el código QR en formato Base64 para mostrarlo en el carnet
   */
  async generateQRCode(studentId: string): Promise<string> {
    try {
      const signedToken = this.generateSignedToken(studentId);
      // Configuramos el QR con el estilo Suizo (Limpio y Alto Contraste)
      return await QRCode.toDataURL(signedToken, {
        errorCorrectionLevel: 'M', // Balance entre legibilidad y daño físico del carnet
        margin: 1,
        color: {
          dark: '#000000', // Negro puro
          light: '#FFFFFF', // Blanco puro
        },
      });
    } catch (err) {
      throw new InternalServerErrorException('Error al generar el QR');
    }
  }
}
