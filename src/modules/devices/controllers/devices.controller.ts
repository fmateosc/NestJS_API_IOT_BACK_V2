import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AccessLevelGuard } from '../../auth/guard/access-level.guard.js';
import { AuthGuard } from '../../auth/guard/auth.guard.js';
import { DevicesService } from '../services/devices.service.js';
import { GetUserInfo } from '../../auth/decorators/user.info.decorator.js';
import type { IUserInfo } from '../../auth/intefaces/auth.interface.js';
import { DeviceDto } from '../dtos/devices.dto.js';
import { Access } from '../../auth/decorators/access.decorator.js';

@Controller('devices')
@UseGuards(AuthGuard, AccessLevelGuard)
export class DevicesController {
  constructor(private readonly deviceService: DevicesService) {}

  /**
   * @description Endpoint POST protegido que permite registrar un nuevo dispositivo físico.
   * Invoca al servicio que crea el equipo en DB y provisiona el Emqx Bridge.
   * @param {DeviceDto} newDeviceData - Payload JSON validado con la información base del dispositivo.
   * @param {IUserInfo} userInfo - Interface extraída del JWT inyectado por el Decorador Auth.
   * @returns {Promise<any>} Objeto con confirmación status, message y device creado.
   */
  @Access('ADMIN')
  @Post('register')
  public async createNewDevice(
    @Body() newDeviceData: DeviceDto,
    @GetUserInfo() userInfo: IUserInfo,
  ) {
    return await this.deviceService.createNewDevice(newDeviceData, userInfo);
  }
}
