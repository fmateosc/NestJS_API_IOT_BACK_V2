import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * @description Utilidad maestra de Cifrado Simétrico AES-256-CBC.
 * Utiliza un Vector de Inicialización (IV) aleatorio por cada operación de guardado,
 * garantizando que incluso datos duplicados tengan representaciones cifradas únicas.
 * El formato resultante en DB es `ivHex:encryptedDataHex`.
 */
export class EncryptionUtil {
  private static readonly logger = new Logger(EncryptionUtil.name);
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly IV_LENGTH = 16;
  private static readonly KEY_SIZE = 32;

  /**
   * @description Cifra una cadena de texto plano.
   * @param {string} text - Texto sensible a proteger.
   * @returns {string} Datagrama cifrado `iv:data` o texto original si falla la configuración.
   */
  static encrypt(text: string): string {
    if (!text) return text;

    try {
      const rawKey = process.env.ENCRYPTION_KEY;
      const key = rawKey ? rawKey.trim() : null;

      // Si no hay clave configurada o no es válida, devolvemos plano (por seguridad operativa transitoria)
      if (!key || key.length !== this.KEY_SIZE) {
        this.logger.warn(
          `ENCRYPTION_KEY not configured or invalid size (got ${key?.length || 0}, needs 32). Storing plain text.`,
        );
        return text;
      }

      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(
        this.ALGORITHM,
        Buffer.from(key),
        iv,
      );

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Encrypt failed: ${message}`);
      return text;
    }
  }

  /**
   * @description Descifra un datagrama `iv:data`. Detecta automáticamente si el dato es texto plano.
   * @param {string} encryptedText - Datagrama proveniente de la base de datos.
   * @returns {string} Texto original descifrado.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const rawKey = process.env.ENCRYPTION_KEY;
      const key = rawKey ? rawKey.trim() : null;

      // Si el dato no contiene el separador ":", asumimos que es Texto Plano (Migración Grácil)
      if (!encryptedText.includes(':')) return encryptedText;
      if (!key || key.length !== this.KEY_SIZE) return encryptedText;

      const [ivHex, dataHex] = encryptedText.split(':');
      if (!ivHex || !dataHex) return encryptedText;

      const iv = Buffer.from(ivHex, 'hex');
      const encryptedBuffer = Buffer.from(dataHex, 'hex');

      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        Buffer.from(key),
        iv,
      );
      let decrypted = decipher.update(encryptedBuffer, 'hex' as any, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // En caso de error (ej: clave cambiada), devolvemos el original para no romper la app
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Decrypt failed, returning original string: ${message}`);
      return encryptedText;
    }
  }
}
