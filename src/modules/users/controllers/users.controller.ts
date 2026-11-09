// src/modules/users/controllers/users.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../services/users.service.js';
import { USER_ORIGIN } from '../../../constants/roles.js';
import { RegisterUserDto } from '../dtos/user.dto.js';
import { UsersEntity } from '../entities/users.entity.js';
import type { Request } from 'express';
import { GetUserInfo } from '../../auth/decorators/user.info.decorator.js';
import type { IUserInfo } from '../../auth/intefaces/auth.interface.js';
import { PaginationDto } from '../../../common/dtos/pagination.dto.js';
import { UpdateUserDto } from '../dtos/update.user.dto.js';
import { PasswordUserDto } from '../dtos/update.password.user.dto.js';
import { AccessLevelGuard } from '../../auth/guard/access-level.guard.js';
import { AuthGuard } from '../../auth/guard/auth.guard.js';
import { PublicAccess } from '../../auth/decorators/public.decorator.js';
import { Access } from '../../auth/decorators/access.decorator.js';

@Controller('users')
@UseGuards(AuthGuard, AccessLevelGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * @description Endpoint POST Público o abierto para el Auto-Registro de Nuevos Administradores Tenant
   * desde la Web App. Su configuración inicial restringe el Auto-Verify, disparando proceso Auth Email.
   * @param {RegisterUserDto} newUserData - Payload JSON.
   * @returns {Promise<any>} Estatus del proceso de auto-servilismo.
   */
  @PublicAccess()
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

  @Access('ROOT')
  @Post('register/root')
  public async createNewUserByRoot(
    @Body() newUserData: RegisterUserDto,
  ): Promise<{ status: boolean; message: string; user: UsersEntity }> {
    return await this.usersService.createNewUser(newUserData, USER_ORIGIN.ROOT);
  }

  /**
   * @description Endpoint GET para resolver info de Entidad individual.
   * Validado por scope: Admin solo puede verse a sí mismo.
   * @param {string} userId - Auth param ID.
   * @param {IUserInfo} userInfo - Decorador JWT.
   * @returns {Promise<UsersEntity>} Entidad mapeada.
   */
  @Access('ADMIN')
  @Get('find/:userId')
  public async findUserById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @GetUserInfo() userInfo: IUserInfo,
  ): Promise<UsersEntity> {
    return await this.usersService.findUserById(userId, userInfo);
  }

  /**
   * @description Endpoint GET restritivo de Auditoría. Retorna la Grilla/Pool de todos
   * los usarios suscritos en la DB. Usado en Panel ROOT Dashboard.
   * @param {PaginationDto} paginationDto - Query string.
   * @returns {Promise<any>} Array Paginado de Usuarios.
   */
  @Access('ROOT')
  @Get('all')
  public async findAllUsers(@Query() paginationDto: PaginationDto): Promise<{
    limit: number;
    offset: number;
    count: number;
    users: UsersEntity[];
  }> {
    return await this.usersService.findAllUsers(paginationDto);
  }

  /**
   * @description Endpoint PUT protegido para forzar la actualización de metadatos de usuario (Nombres, AccessLevel, etc).
   * @param {string} userId - Auth param ID.
   * @param {UpdateUserDto} updatedUserData - Payload JSON parcial.
   * @param {IUserInfo} userInfo - Decorador JWT limitando modificaciones fuera de tenant.
   * @returns {Promise<any>} Objeto de usuario impactado con Success=True.
   */
  @Access('ADMIN')
  @Put('update/:userId')
  public async updateUserById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updatedUserData: UpdateUserDto,
    @GetUserInfo() userInfo: IUserInfo,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    return await this.usersService.updateUserById(
      updatedUserData,
      userId,
      userInfo,
    );
  }

  /**
   * @description Endpoint DELETE protegido. Inicia la eliminación física en cascada
   * del usuario y todos sus Devices, Tasks y Messages atados.
   * @param {string} userId - UUID.
   * @param {IUserInfo} userInfo - Extrae el actor para validar si no es ROOT, asegurar que solo se borre a sí mismo.
   * @returns {Promise<any>} Status booleano y Entidad purgada final.
   */
  @Access('ADMIN')
  @Delete('delete/:userId')
  public async deleteUserById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @GetUserInfo() userInfo: IUserInfo,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    return await this.usersService.deleteUserById(userId, userInfo);
  }

  /**
   * @description Endpoint PUT aislado para la rotación de contraseñas.
   * Valida que el oldPassword haga Match físico antes de cambiarlo.
   * @param {string} userId - UUID del objetivo.
   * @param {PasswordUserDto} userPasswordData - DTO con credenciales (viejo, nuevo, confirmar).
   * @returns {Promise<any>} Objeto status confirmación.
   */
  @Access('ADMIN')
  @Put('update/password/:userId')
  public async updateUserPasswordById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() userPasswordData: PasswordUserDto,
  ): Promise<{ status: boolean; user: UsersEntity }> {
    return await this.usersService.updateUserPasswordById(
      userPasswordData,
      userId,
    );
  }

  /**
   * @description Endpoint POST protegido que acciona la habilidad u obligación del Segundo Factor (2FA).
   * Limpia la memoria expiratoria y código si se inhabilita.
   * @param {boolean} isEnabled - Bandera booleana deseada.
   * @param {IUserInfo} userInfo - Contexto actor solicitante.
   * @returns {Promise<{ status: boolean }>} Objeto JSON con success.
   */
  @Access('ADMIN')
  @Post('toggle-2fa')
  public async toggleTwoStepAuth(
    @Body('isEnabled') isEnabled: boolean,
    @GetUserInfo() userInfo: IUserInfo,
  ): Promise<{ status: boolean }> {
    const success = await this.usersService.toggleTwoStepAuth(
      userInfo.userId,
      isEnabled,
    );
    return { status: success };
  }

  // TODO: verify-email
}
