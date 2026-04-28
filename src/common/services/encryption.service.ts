import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly logger = new Logger(EncryptionService.name);

  // Derivamos una llave perfecta de 32 bytes a partir de tu variable de entorno
  private get key() {
    const secret =
      process.env.ENCRYPTION_KEY || 'clave_secreta_de_desarrollo_uecg_2026';
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encripta un texto plano (Ej: CI, Teléfono)
   */
  encrypt(text: string | null): string | null {
    if (!text) return null;

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      // Guardamos todo junto: Vector + Etiqueta de Autenticidad + Dato Encriptado
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      this.logger.error('Error al encriptar el dato', error);
      throw new InternalServerErrorException('Error de seguridad interno.');
    }
  }

  /**
   * Desencripta un texto previamente encriptado
   */
  decrypt(encryptedText: string | null): string | null {
    if (!encryptedText) return null;

    try {
      const parts = encryptedText.split(':');
      // Fallback: Si el texto no tiene el formato encriptado, lo devuelve tal cual
      // Esto es vital para que el sistema no explote mientras migras datos viejos
      if (parts.length !== 3) return encryptedText;

      const [ivHex, authTagHex, encryptedData] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.warn(
        'Error al desencriptar. Devolviendo texto original como fallback.',
        error,
      );
      return encryptedText;
    }
  }

  /**
   * Genera el "Índice Ciego" estático para búsquedas exactas en la DB (SHA-256)
   */
  generateBlindIndex(text: string | null): string | null {
    if (!text) return null;

    // Convertimos a minúsculas y quitamos espacios para evitar fallos de búsqueda por "dedazos"
    return crypto
      .createHmac('sha256', this.key)
      .update(text.toLowerCase().trim())
      .digest('hex');
  }
}
