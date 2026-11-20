// src/modules/devices/services/devices.services.ts

import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DevicesEntity } from '../entities/devices.entity.js';
import { QueryFailedError, Repository } from 'typeorm';
import { DeviceDto } from '../dtos/devices.dto.js';
import { IUserInfo } from '../../auth/intefaces/auth.interface.js';
import { QueryBuilderUtil } from '../../../util/query-builder.util.js';
import { UpdateDeviceDto } from '../dtos/update.device.dto.js';
import { PaginationDto } from '../../../common/dtos/pagination.dto.js';
import { EmqxApiService } from '../../providers/http/emqx-api.service.js';
import type { IEmqxBannedResponseData } from '../../../common/interfaces/emqx.interface.js';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(DevicesEntity)
    private readonly deviceRepository: Repository<DevicesEntity>,
    @Inject(forwardRef(() => EmqxApiService))
    private readonly httpEmqxApiService: EmqxApiService,
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
          'Ya existe un dispositivo con ese serial',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Otros errores técnicos se manejan en el filtro global | Other technical errors are handled in the global filter
      throw error;
    }

    // API EMQX
    const isInitialized =
      await this.httpEmqxApiService.ensureSettingsInitialized();

    if (isInitialized) {
      try {
        // Captura la regla del topico para enviar a la API
        const deviceWithUser = await this.deviceRepository.findOne({
          where: { id: savedDevice.id },
          relations: { createUserId: true },
        });

        if (!deviceWithUser) {
          throw new HttpException(
            'Dispositivo no encontrado',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        // Crea el bridge y busca los baneados | Create the bridge and search for the banned ones
        const [respEmqxBridge, bannedList] = await Promise.all([
          this.httpEmqxApiService.emqxApiPostBridge({
            name: deviceWithUser.deviceSerial,
            user: deviceWithUser.createUserId.username,
          }),

          this.httpEmqxApiService.emqxApiGetBannedList(),
        ]);

        // Actualiza el dispositivo con la data del bridge | Update the device with the bridge data
        const updatePromise = this.updateDeviceById(
          {
            bridgeRuleId: `${respEmqxBridge.type}:${respEmqxBridge.name}`,
            bridgeRuleEnabled: true, // new
          },
          savedDevice.id,
          userInfo,
        );

        const unbanPromise = this.checkWhoParameter(
          bannedList,
          savedDevice.deviceSerial,
        );

        // Ejecutar en paralelo y verificar errores | Run in parallel and check for errors
        const [updateResult, unbanResult] = await Promise.allSettled([
          updatePromise,
          unbanPromise,
        ]);

        const hasError = [updateResult, unbanResult].some(
          (r) => r.status === 'rejected',
        );

        if (hasError) {
          // Rollback si algo falló | Rollback if something went wrong
          await this.deviceRepository.delete(savedDevice.id);

          throw new HttpException(
            'Una o varias operaciones de EMQX han fallado. Se han revertido los cambios.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      } catch (error) {
        // Rollback por cualquier excepción imprevista | Rollback for any unforeseen exceptions
        await this.deviceRepository.delete(savedDevice.id);

        throw new HttpException(
          'Error al crear el dispositivo debido a un error en la API de EMQX. Se han revertido los cambios.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return {
      status: true,
      message: `El dispositivo "${savedDevice.deviceName}" con el número de serie "${savedDevice.deviceSerial}" se ha creado correctamente`,
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
        `el dispositivo con Id "${deviceId}" no se encuantra en el sistema`,
        HttpStatus.NOT_FOUND,
      );
    }

    return deviceResult;
  }

  /**
   * @description Mutación de propiedades físicas o lógicas de un Dispositivo. Modifica campos relacionales básicos
   * y replica los cambios críticos (como el estado ENABLED/DISABLED) hacia el Broker MQTT (EMQX)
   * mediante las APIs REST del mismo, asegurando desconexión o bloqueo de red inmediata.
   * @param {UpdateDeviceDto} updateDeviceData - DTO parcial con banderas a parchear.
   * @param {string} deviceId - UUID primario objetivo.
   * @param {IUserInfo} userInfo - Actor de la transacción para validación de propiedad (Autorización).
   * @returns {Promise<{ status: boolean; message: string; device: DevicesEntity }>} Objeto transaccional de éxito.
   * @throws {HttpException} Retorna errores 400 si se intenta mutar al mismo estado actual, o 404 si no se halla.
   */
  public async updateDeviceById(
    updateDeviceData: UpdateDeviceDto,
    deviceId: string,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; message: string; device: DevicesEntity }> {
    const existingDevice = await this.findDeviceById(deviceId, userInfo);

    await this.deviceRepository.update(deviceId, updateDeviceData);

    // TODO: update en EMQX API
    const ensureSettingsInitialized =
      await this.httpEmqxApiService.ensureSettingsInitialized();

    if (
      ensureSettingsInitialized &&
      typeof updateDeviceData.deviceStatus === 'boolean' &&
      existingDevice.bridgeRuleId
    ) {
      if (existingDevice.deviceStatus === updateDeviceData.deviceStatus) {
        throw new HttpException(
          `The device is already ${updateDeviceData.deviceStatus ? 'enabled' : 'disabled'}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (updateDeviceData.deviceStatus) {
        await this.httpEmqxApiService.emqxApiDeleteBanned({
          as: 'clientid',
          who: existingDevice.deviceSerial,
        });
      } else {
        await this.httpEmqxApiService.emqxApiPostAddBanned({
          as: 'clientid',
          who: existingDevice.deviceSerial,
          reason: 'Disabled by User',
        });
      }
    }

    if (
      typeof updateDeviceData.bridgeRuleEnabled === 'boolean' &&
      existingDevice.bridgeRuleId
    ) {
      if (
        updateDeviceData.bridgeRuleEnabled === existingDevice.bridgeRuleEnabled
      ) {
        throw new HttpException(
          `The device bridge rule is already ${updateDeviceData.bridgeRuleEnabled ? 'enabled' : 'disabled'}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.httpEmqxApiService.emqxApiPutEnableDisableBridge(
        existingDevice.bridgeRuleId,
        updateDeviceData.bridgeRuleEnabled,
      );
    }

    return {
      status: true,
      message: `El dispositivo con Id "${existingDevice.deviceSerial}" se ha actualizado`,
      device: { ...existingDevice, ...updateDeviceData },
    };
  }

  /**
   * @description Elimina un dispositivo físicamente de la base de datos y orquesta su limpieza en cascada ("Macro a Micro").
   * Esto incluye borrar los mensajes en caché, purgar tareas (cron jobs) asociadas en memoria/DB,
   * remover las reglas de puente (Bridges) en EMQX, y agregar el serial a la lista de baneados
   * para evitar reconexiones "fantasmas" del hardware físico.
   * @param {string} deviceId - ID del dispositivo a destruir.
   * @param {IUserInfo} userInfo - Token decodificado del solicitante administrando permisos.
   * @returns {Promise<{ status: boolean, device: DevicesEntity }>} Resultado confirmatorio de la destrucción.
   * @throws {HttpException} Retorna error 500 y ejecuta Rollback si la pasarela EMQX fracasa.
   */
  public async deleteDeviceById(
    deviceId: string,
    userInfo: IUserInfo,
  ): Promise<{ status: boolean; device: DevicesEntity }> {
    const existingDevice = await this.findDeviceById(deviceId, userInfo);

    /* await this.messagesService.deleteAllMessagesByClientId(
      existingDevice.deviceSerial,
      userInfo,
    );
    
    await this.taskService.deleteAllTasksByDeviceSerial(
      existingDevice.deviceSerial,
      userInfo,
    ); */

    await this.deviceRepository.delete(deviceId);

    const ensureSettingsInitialized =
      await this.httpEmqxApiService.ensureSettingsInitialized();

    if (existingDevice && ensureSettingsInitialized) {
      const tasks: Promise<any>[] = [];

      if (existingDevice.bridgeRuleId) {
        tasks.push(
          this.httpEmqxApiService.emqxApiDeleteBridge(
            existingDevice.bridgeRuleId,
          ),
        );
      }

      tasks.push(
        this.httpEmqxApiService.emqxApiPostAddBanned({
          as: 'clientid',
          who: existingDevice.deviceSerial,
          reason: 'Deleted by User',
        }),
      );

      const results = await Promise.allSettled(tasks);
      const failed = results.find((result) => result.status === 'rejected');

      if (failed) {
        // Restauración por fallo en limpieza EMQX
        await this.deviceRepository.save(existingDevice);
        throw new HttpException(
          'Una o varias operaciones de limpieza en EMQX han fallado. Se ha restaurado el registro local para mantener la estabilidad del sistema.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return {
      status: true,
      device: existingDevice,
    };
  }

  /**
   * @description Lista los dispositivos registrados en la plataforma bajo un cursor de paginación (Limit, Offset).
   * Aplica mitigación de carga de Tenant (RBAC) para aislar datos entre administradores.
   * Soporta filtros condicionales por Tipo de Dispositivo (type) o Búsqueda Textual Libre (search).
   * @param {PaginationDto} paginationDto - DTO con variables de filtrado y paginación.
   * @param {IUserInfo} userInfo - Contexto del actor para el scope de seguridad.
   * @returns {Promise<{ limit: number, offset: number, count: number, devices: DevicesEntity[] }>} Matriz paginada.
   */
  public async findAllDevices(
    paginationDto: PaginationDto,
    userInfo: IUserInfo,
  ): Promise<{
    limit: number;
    offset: number;
    count: number;
    devices: DevicesEntity[];
  }> {
    const limit = paginationDto.limit || Number(process.env.LIMIT) || 1000;
    const offset = paginationDto.offset || Number(process.env.OFFSET) || 0;

    const queryBuilder = this.deviceRepository
      .createQueryBuilder('devices')
      .leftJoinAndSelect('devices.createUserId', 'createUserId')
      .take(limit)
      .skip(offset);

    // Aplicar Seguridad Centralizada
    QueryBuilderUtil.applyUserScope(queryBuilder, 'devices', userInfo);

    if (paginationDto.type) {
      queryBuilder.andWhere('devices.deviceType = :type', {
        type: paginationDto.type,
      });
    }

    if (paginationDto.search) {
      queryBuilder.andWhere(
        '(devices.deviceName LIKE :search OR devices.deviceSerial LIKE :search)',
        { search: `%${paginationDto.search}%` },
      );
    }

    const [devices, count] = await queryBuilder.getManyAndCount();

    return {
      limit,
      offset,
      count,
      devices,
    };
  }

  /**
   * @description Test de integración rápida para diagnosticar la salud y conectividad contra el EMQX (Broker MQTT).
   * @returns {Promise<any>} Listado asíncrono de tópicos subscritos o activos provenientes del API EMQX.
   */
  public async testEmqxApi() {
    return this.httpEmqxApiService.emqxApiGetTopicList();
  }

  /**
   * @description Verifica en tiempo de ejecución de alta de capa EMQX, si dentro de la colección global
   * de IDs o Seriales baneados por el broker, se halla el del dispositivo actualmente siendo aprovisionado,
   * y de ser así, lo remueve para permitir una autenticación limpia al inicializar.
   * @param {IEmqxBannedResponseData} response - Listado de datos devueltos por el Endpoint "Banned" de EMQX.
   * @param {string} whoParam - Cadena identificadora unívoca del serial del microcontrolador (Ej: ESP32...).
   * @returns {Promise<void>} Operación asíncrona silenciosa en caso de éxito o de que no requiera borrado.
   */
  private async checkWhoParameter(
    response: IEmqxBannedResponseData,
    whoParam: string,
  ): Promise<void> {
    const bannedSet = new Set(response.data.map((item) => item.who));
    if (bannedSet.has(whoParam)) {
      await this.httpEmqxApiService.emqxApiDeleteBanned({
        as: 'clientid',
        who: whoParam,
      });
    }
  }

  /**
   * @description Utilitario genérico para inyecciones manuales (Bypass a selectores TypeORM)
   * buscando de forma parametrizada Dispositivos basados en un par de (Llave -> Valor) dinámico.
   * @param {Object} params - Diccionario con `key` (Clave en DeviceDto) y `value` de búsqueda.
   * @returns {Promise<DevicesEntity | null>} El dispositivo si es hallado, caso contrario null.
   */
  public async findBy({
    key,
    value,
  }: {
    key: keyof DeviceDto;
    value: any;
  }): Promise<DevicesEntity | null> {
    const device = await this.deviceRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.createUserId', 'createUserId')
      .where(`device.${key} = :value`, { value })
      .getOne();

    return device;
  }

  /**
   * @description Muta asíncronamente las banderas transitorias de Conectividad para un Dispositivo.
   * Implementa un "Fast-Path" mediante UPDATE directo a base de datos para garantizar escalabilidad
   * bajo ráfagas intensas de Mensajería MQTT/Webhooks.
   * Omitimos la orquestación pesada de EMQX (Baneo/Bridge) ya que los latidos no alteran la configuración.
   * @param {string} deviceSerial - Cadena unívoca/firmware identificando al hardware interactuando.
   * @param {boolean} status - Banderín Verdadero (Conectado) / Falso (Desconectado offline).
   * @returns {Promise<void>} Operación transaccional de alto rendimiento.
   */
  public async updateDeviceConnection(
    deviceSerial: string,
    status: boolean,
  ): Promise<void> {
    try {
      await this.deviceRepository
        .createQueryBuilder()
        .update(DevicesEntity)
        .set({
          deviceLastseen: new Date(),
          deviceOnline: status,
        })
        .where('deviceSerial = :deviceSerial', { deviceSerial })
        .execute();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error al actualizar el estado de conexión del dispositivo ${deviceSerial}: ${message}`,
      );
    }
  }
}
