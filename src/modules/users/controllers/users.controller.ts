// src/modules/users/controllers/users.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { UsersService } from '../services/users.service.js';
import { USER_ORIGIN } from '../../../constants/roles.js';
import { RegisterUserDto } from '../dtos/user.dto.js';
import { UsersEntity } from '../entities/users.entity.js';
import type { Request } from 'express';
import { GetUserInfo } from '../../auth/decorators/user.info.decorator.js';
import type { IUserInfo } from '../../auth/intefaces/auth.interface.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * @description Endpoint POST Público o abierto para el Auto-Registro de Nuevos Administradores Tenant
   * desde la Web App. Su configuración inicial restringe el Auto-Verify, disparando proceso Auth Email.
   * @param {RegisterUserDto} newUserData - Payload JSON.
   * @returns {Promise<any>} Estatus del proceso de auto-servilismo.
   */

  @Post('register')
  public async createNewUser(
    @Body() newUserData: RegisterUserDto,
    @Req() req: Request,
  ): Promise<{ status: boolean; message: string; user: UsersEntity }> {
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

    return await this.usersService.createNewUser(
      newUserData,
      USER_ORIGIN.WEB,
      baseUrl,
    );
  }

  // TODO: Implementar endpoint POST para creación de usuarios desde Backend (Root) con origen USER_ORIGIN.ROOT

  /**
   * @description Endpoint GET para resolver info de Entidad individual.
   * Validado por scope: Admin solo puede verse a sí mismo.
   * @param {string} userId - Auth param ID.
   * @param {IUserInfo} userInfo - Decorador JWT.
   * @returns {Promise<UsersEntity>} Entidad mapeada.
   */
  @Get('find/:userId')
  public async findUserById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @GetUserInfo() userInfo: IUserInfo,
  ): Promise<UsersEntity> {
    return await this.usersService.findUserById(userId, userInfo);
  }
}
