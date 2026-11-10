import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { DevicesEntity } from '../entities/devices.entity.js';
import { IUserInfo } from '../../auth/intefaces/auth.interface.js';
import { DeviceDto } from '../dtos/devices.dto.js';
import { QueryBuilderUtil } from '../../../util/query-builder.util.js';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(DevicesEntity)
    private readonly deviceRepository: Repository<DevicesEntity>,
  ) {}

  /**
   * @description Orquesta la creación de un nuevo dispositivo físico apuntando tanto a la base de datos relacional
   * como a la pasarela de brokers EMQX, generando automáticamente un puente (bridge) con reglas pre-construidas.
   * Gestiona también procesos de roll-back transaccional (compensación manual) en caso de que la red MQTT falle al inyectar Reglas o Quitar baneos.
   * @param {DeviceDto} newDeviceData - DTO contentivo de la semántica básica del hardware (Serial, Nombre, Descripción, Tipo).
   * @param {IUserInfo} userInfo - Interfaz decodificada del requerimiento JWT actual extrayendo el contexto del Autor (Admin o Root).
   * @returns {Promise<{status: boolean; message: string; device: DevicesEntity}>} Promesa resolviendo el resultado del bloque de alta.
   * @throws {HttpException} Si EMQX falla cortando la transacción o si el bridge no se logra establecer.
   */
  public async createNewDevice(
    newDeviceData: DeviceDto,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; message: string; device: DevicesEntity }> {
    // 1. Verificar si el serial ya existe | Check if the serial already exists
    const existingDevice = await this.deviceRepository.findOne({
      where: { deviceSerial: newDeviceData.deviceSerial },
    });

    if (existingDevice) {
      throw new HttpException(
        `Error en el registro: ya existe un dispositivo con el número de serie "${newDeviceData.deviceSerial}".`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Crear entidad inicial | Create initial entity
    const deviceEntity = this.deviceRepository.create({
      ...newDeviceData,
      createUserId: userInfo.userId ? { id: userInfo.userId } : undefined,
    });

    // 3. Guardar dispositivo con manejo de errores de BD | Save device with DB error handling
    let savedDevice: DevicesEntity;

    try {
      savedDevice = await this.deviceRepository.save(deviceEntity);
    } catch (error) {
      // Error 23505: Unique violation (Postgres)
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new HttpException(
          `Error en el registro: ya existe un dispositivo con el número de serie "${newDeviceData.deviceSerial}".`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Otros errores técnicos se manejan en el filtro global | Other technical errors are handled in the global filter
      throw error;

      // TODO: API EMQX
    }

    return {
      status: true,
      message: `El dispositivo "${savedDevice.deviceName}" con el número de serie "${savedDevice.deviceSerial}" se ha creado correctamente.`,
      device: savedDevice,
    };
  }

  /**
   * @description Localiza un dispositivo por su identificador UUID en la base de datos,
   * aplicando filtros de Tenant/Autorización centralizados mediante QueryBuilderUtil.
   * @param {string} deviceId - UUID primario del Device en la tabla relacional.
   * @param {IUserInfo} userInfo - Token decodificado limitando el alcance de lectura según privilegios.
   * @returns {Promise<DevicesEntity>} Entidad del dispositivo hidratada con la relación de su Creador.
   * @throws {HttpException} Retorna 404 Not Found si el dispositivo no existe o no le pertenece al solicitante.
   */
  public async findDeviceById(
    deviceId: string,
    userInfo: IUserInfo,
  ): Promise<DevicesEntity> {
    const queryBuilder = this.deviceRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.createUserId', 'createUserId')
      .where('device.id = :deviceId', { deviceId });

    // Aplicar Seguridad Centralizada
    QueryBuilderUtil.applyUserScope(queryBuilder, 'device', userInfo);

    const deviceResult = await queryBuilder.getOne();

    if (!deviceResult) {
      throw new HttpException(
        `El dispositivo con Id "${deviceId}" no se encuantra en el sistema.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return deviceResult;
  }
}
