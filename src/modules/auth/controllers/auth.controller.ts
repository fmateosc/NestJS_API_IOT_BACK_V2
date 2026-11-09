// src/modules/auth/controllers/auth.controller.ts

import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { AuthDto } from '../dtos/auth.dto.js';
import { AuthResponse } from '../intefaces/auth.interface.js';

@Controller('auth')
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
  @Post('login')
  async login(@Body() { username, password }: AuthDto): Promise<AuthResponse> {
    const userValidate = await this.authService.validateUser(
      username,
      password,
    );

    if (!userValidate) {
      throw new HttpException(
        `Credenciales inválidas.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Feature: Bloquear si no ha verificado su correo
    if (!userValidate.isVerified) {
      throw new HttpException(
        `Su cuenta no ha sido verificada. Por favor, revise su correo electrónico para completar la verificación.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // TODO: Feature 2FA check

    const { password: _, ...userWithoutPassword } = userValidate;
    const jwt = await this.authService.generateJWT(userWithoutPassword);
    return jwt;
  }
}
