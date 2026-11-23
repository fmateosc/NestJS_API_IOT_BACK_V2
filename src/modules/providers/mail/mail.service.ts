import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../../settings/services/settings.service.js';
import { authTemplates } from './templates/auth.templates.js';

@Injectable()
export class MailService {
  private logger = new Logger(MailService.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * @description Crea internamente la configuración de Nodemailer tomando de fuente primaria
   * los General Settings almacenados en la BDD del sistema. 
   * Previene fallos al verificar la existencia del host SMTP.
   * @returns {Promise<nodemailer.Transporter | null>} 
   */
  private async createTransporter() {
    try {
      const settings = await this.settingsService.findGeneralSettings();
      if (!settings || !settings.smtpHost) {
        throw new Error('No valid SMTP settings found in database');
      }

      return nodemailer.createTransport({
        host: settings.smtpHost,
        port: Number(settings.smtpPort),
        secure: settings.smtpSecure,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPassword,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Could not create mail transporter: ${message}`);
      return null;
    }
  }

  /**
   * @description Envía asincrónicamente el correo con la plantilla encapsulada para verificación de registro.
   * Cuenta con capa Fail-Safe para evitar que caídas de SMTP afecten la experiencia del Signup.
   * @param {string} toEmail - Destinatario.
   * @param {string} fullName - Nombre del receptor (fallback al fragmento de correo local).
   * @param {string} verificationToken - Token JWT a inyectar en la URL de callback.
   * @returns {Promise<void>}
   */
  public async sendVerificationEmail(
    toEmail: string,
    fullName: string,
    verificationToken: string,
    baseUrl?: string,
  ): Promise<void> {
    const transporter = await this.createTransporter();
    
    // Fail-Safe architecture: Si no hay settings o es nulo, no se detiene la ejecución HTTP de Register
    if (!transporter) {
      this.logger.warn(
        `[Fail-Safe] Ignoring Email Verification to ${toEmail} due to missing SMTP Settings.`,
      );
      return;
    }

    // Dynamic URL detection
    const protocolAndHost = baseUrl || 'http://localhost:3011';
    const verificationUrl = `${protocolAndHost}/api/v1/users/verify-email?token=${verificationToken}`;
    
    const htmlContent = authTemplates.verificationEmail(
      verificationUrl,
      fullName || toEmail.split('@')[0],
    );

    try {
      await transporter.sendMail({
        from: `"Sistema IoT" <no-reply@iothost.org>`,
        to: toEmail,
        subject: '💡 Verifica tu Cuenta - Action Required',
        html: htmlContent,
      });
      this.logger.log(`Verification email successfully sent to ${toEmail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to send verification email to ${toEmail}: ${message}`,
      );
    }
  }

  /**
   * @description Envía asincrónicamente el correo con el Link Único de Reset Password.
   * Impide fugas de información transaccional actuando mediante Fail-Safe Logger.
   * @param {string} toEmail - Destinatario afectado.
   * @param {string} fullName - Dueño de la cuenta (fallback).
   * @param {string} resetToken - Token Seguro de Caducidad controlada para la URL.
   * @returns {Promise<void>}
   */
  public async sendPasswordResetEmail(
    toEmail: string,
    fullName: string,
    resetToken: string,
    baseUrl?: string,
  ): Promise<void> {
    const transporter = await this.createTransporter();
    
    if (!transporter) {
      this.logger.warn(
        `[Fail-Safe] Ignoring Password Reset Email to ${toEmail} due to missing SMTP Settings.`,
      );
      return;
    }

    const protocolAndHost = baseUrl || 'http://localhost:3011';
    const resetUrl = `${protocolAndHost}/api/v1/auth/reset-password?token=${resetToken}`;
    
    const htmlContent = authTemplates.passwordResetEmail(
      resetUrl,
      fullName || toEmail.split('@')[0],
    );

    try {
      await transporter.sendMail({
        from: `"Sistema IoT" <no-reply@iothost.org>`,
        to: toEmail,
        subject: '🔒 Password Reset Request',
        html: htmlContent,
      });
      this.logger.log(`Password reset email successfully sent to ${toEmail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send password reset email to ${toEmail}: ${message}`,
      );
    }
  }

  /**
   * @description Envía el OTP (código numérico) de segundo factor (2FA) al destinatario.
   * Utiliza la plantilla interactiva de AuthTemplates inyectada dinámicamente. 
   * @param {string} toEmail - Receptor.
   * @param {string} fullName - Nombre para personalización.
   * @param {string} code - PIN Secreto de validación.
   * @returns {Promise<void>}
   */
  public async sendTwoStepCodeEmail(
    toEmail: string,
    fullName: string,
    code: string,
  ): Promise<void> {
    const transporter = await this.createTransporter();
    
    if (!transporter) {
      this.logger.warn(`[Fail-Safe] Ignoring 2FA Email to ${toEmail} due to missing SMTP Settings.`);
      return;
    }

    const htmlContent = authTemplates.twoFactorCodeEmail(code, fullName || toEmail.split('@')[0]);

    try {
      await transporter.sendMail({
        from: `"Sistema IoT Seguridad" <no-reply@iothost.org>`,
        to: toEmail,
        subject: '🔐 Tu código de seguridad - 2FA',
        html: htmlContent,
      });
      this.logger.log(`2FA email successfully sent to ${toEmail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`Failed to send 2FA email to ${toEmail}: ${message}`);
    }
  }
}
