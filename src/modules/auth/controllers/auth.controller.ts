// src/modules/auth/controllers/auth.controller.ts

import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { AuthDto } from '../dtos/auth.dto.js';
import { AuthResponse } from '../intefaces/auth.interface.js';
import { AccessLevelGuard } from '../guard/access-level.guard.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { PublicAccess } from '../decorators/public.decorator.js';
import type { Request } from 'express';
import { authTemplates } from '../../providers/mail/templates/auth.templates.js';

@Controller('auth')
@UseGuards(AuthGuard, AccessLevelGuard)
export class AuthController {
  private logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * @description Endpoint POST Público Principal. Orquesta las validaciones de acceso
   * (Hash Password vs Database, Banderas de Verificación de Email y Traba 2FA Activa).
   * @param {AuthDto} payload - Objeto Body JSON validado con credenciales `username` y `password`.
   * @returns {Promise<AuthResponse>} Firma JWT Final hidratada o Desvío lógico avisando que el MFA es Requerido.
   */
  @PublicAccess()
  @Post('login')
  async login(@Body() { username, password }: AuthDto): Promise<AuthResponse> {
    const userValidate = await this.authService.validateUser(
      username,
      password,
    );
    if (!userValidate) {
      throw new HttpException(
        `Invalid username or password`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Feature: Bloquear si no ha verificado su correo
    if (!userValidate.isVerified) {
      throw new HttpException(
        `Your account is not verified. Please check your email inbox to verify your account.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Feature 2FA check
    if (userValidate.isTwoStepAuthEnabled) {
      await this.usersService.generateAndSendTwoStepCode(userValidate.id);
      return {
        requires2FA: true,
        userId: userValidate.id,
        message: 'Two-step verification code sent to your email.',
      };
    }

    const { password: _, ...userWithoutPassword } = userValidate;
    const jwt = await this.authService.generateJWT(userWithoutPassword);
    return jwt;
  }

  /**
   * @description Endpoint POST de continuidad del Login Público. Recibe el código OTP de 6 dígitos
   * enviado por correo al usuario que posée el MFA 2FA activado, validando la integridad del Token de expiración fina.
   * @param {string} userId - UUID retenido temporalmente por el frontend desde el paso 1.
   * @param {string} code - OTP digitado por el humano.
   * @returns {Promise<AuthResponse>} Tupla JWT y Objeto final si el éxito es verificado.
   */
  @PublicAccess()
  @Post('verify-2fa')
  async verify2FA(
    @Body('userId') userId: string,
    @Body('code') code: string,
  ): Promise<AuthResponse> {
    if (!userId || !code) {
      throw new HttpException(
        'User ID and verification code are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await this.usersService.verifyTwoStepCode(userId, code);
    if (!isValid) {
      throw new HttpException(
        'Invalid or expired verification code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findOneSimple(userId);
    const { password: _, ...userWithoutPassword } = user;
    const jwt = await this.authService.generateJWT(userWithoutPassword);
    return jwt;
  }

  /**
   * @description Endpoint POST de Auxilio. Genera y transmite asíncronamente un nuevo OTP
   * si el usuario dejó expirar la ventana de 15 minutos de su 2FA previo al Login exitoso.
   * @param {string} userId - UUID retornado en el intento primario de Auth.
   * @returns {Promise<any>} Objeto Feed de estado para Feedback UI.
   */
  @PublicAccess()
  @Post('resend-2fa')
  async resend2FA(
    @Body('userId') userId: string,
  ): Promise<{ status: boolean; message: string }> {
    if (!userId) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    const success = await this.usersService.generateAndSendTwoStepCode(userId);
    if (!success) {
      throw new HttpException(
        'User not found or error generating code',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      status: true,
      message: 'A new verification code has been sent to your email.',
    };
  }

  /**
   * @description Endpoint POST inicial del flujo "Olvidé mi contraseña".
   * Ingiere un correo y dispara asíncronamente (vía `UsersService`) el Template Link
   * con el Token criptográfico generado. Por diseño anti-Spam/Enumeration, nunca confiesa si el mail existe.
   * @param {string} email - Literal address objetivo.
   * @returns {Promise<any>} Status OK genérico afirmativo.
   */
  @PublicAccess()
  @Post('forgot-password')
  async forgotPassword(
    @Body('email') email: string,
    @Req() req: Request,
  ): Promise<{ status: boolean; message: string }> {
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }

    const host = req.get('host');
    const protocol = req.protocol;

    // Smart URL Inference: If in production and host is local/missing, force api.iothost.org
    let baseUrl = `${protocol}://${host}`;
    if (
      host &&
      (host.includes('api.iothost.org') ||
        (process.env.NODE_ENV === 'production' &&
          (host.includes('127.0.0.1') || host.includes('localhost'))))
    ) {
      baseUrl = 'https://api.iot.gammaautomations.es/';
    }

    await this.usersService.generatePasswordResetToken(email, baseUrl);
    return {
      status: true,
      // Respondemos exitósamente siempre para evitar Username Enumeration
      message:
        'If an account exists for this email, a password reset link has been sent. Please check your Inbox and SPAM folder.',
    };
  }

  /**
   * @description Endpoint GET Renderizador (SSR UI) Webhook apuntado por el botón del Email de Recuperación.
   * Quema (Consume) el Token-URL original de inmediato e inyecta uno Dinámico-Nuevo hacia el
   * Formulario embebido HTML (Previene doble pulsación o expiraciones demoradas).
   * @param {string} token - Query Param Token HMAC1 original.
   * @returns {Promise<string>} Vista stringificada en crudo de HMTL Vanilla y CSS Embebido.
   */
  @PublicAccess()
  @Get('reset-password')
  @Header('Content-Type', 'text/html')
  async getResetPasswordPage(
    @Query('token') token: string,
    @Req() req: Request,
  ): Promise<string> {
    const host = req.get('host');
    let frontUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Smart URL Inference for Frontend
    if (
      host &&
      (host.includes('api.iothost.org') ||
        (process.env.NODE_ENV === 'production' &&
          (host.includes('127.0.0.1') || host.includes('localhost'))))
    ) {
      frontUrl = 'https://iothost.org';
    }
    const loginUrl = `${frontUrl}/auth/login`;

    if (!token) {
      return authTemplates.passwordResetResponse(
        false,
        'Security Token is required',
        loginUrl,
      );
    }

    try {
      const { userName, newToken } =
        await this.usersService.consumeAndRotateToken(token);
      return authTemplates.passwordResetForm(newToken, userName);
    } catch (error: any) {
      return authTemplates.passwordResetResponse(
        false,
        'Reset link is invalid, has expired, or has already been opened.',
        loginUrl,
      );
    }
  }

  /**
   * @description Form-Action POST accionado por el `getResetPasswordPage` interno.
   * Captura el Token quemado secundario y la contraseña digitada en el Form temporal
   * para re-hashear la base de datos por el servicio Users.
   * @param {string} token - Input Oculto quemado del Form.
   * @param {string} newPassword - Componente DOM input type password.
   * @returns {Promise<string>} Feedback HTML de éxito con botón para retornar a Vue.
   */
  @PublicAccess()
  @Post('reset-password')
  @Header('Content-Type', 'text/html')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Req() req: Request,
  ): Promise<string> {
    const host = req.get('host');
    let frontUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Smart URL Inference for Frontend
    if (
      host &&
      (host.includes('api.iothost.org') ||
        (process.env.NODE_ENV === 'production' &&
          (host.includes('127.0.0.1') || host.includes('localhost'))))
    ) {
      frontUrl = 'https://iothost.org';
    }
    const loginUrl = `${frontUrl}/auth/login`;

    try {
      await this.usersService.resetPasswordWithToken(token, newPassword);
      return authTemplates.passwordResetResponse(
        true,
        'Your password has been successfully reset. You can now login.',
        loginUrl,
      );
    } catch (error: any) {
      return authTemplates.passwordResetResponse(
        false,
        error.message || 'Password reset failed. Validation Error.',
        loginUrl,
      );
    }
  }
}
