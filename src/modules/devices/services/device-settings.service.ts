// src/modules/devices/services/device-settings.service.ts

import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceSettingsEntity } from '../entities/device-settings.entity.js';
import { Repository } from 'typeorm';
import { DevicesEntity } from '../entities/devices.entity.js';
import { MqttService } from '../../providers/mqtt/mqtt.service.js';
//import { WebsocketsGateway } from '../../providers/websockets/websockets.gateway.js';
import * as wrapperType from '../../../common/types/wrapper.type.js';

/**
 * @description Servicio de sincronización bilateral de configuraciones ESP32 ↔ Cloud.
 * Administra dos copias paralelas de configuración por dispositivo:
 * - `deviceData`: Lo que el ESP32 realmente tiene (reportado vía MQTT).
 * - `platformData`: Lo que el cloud desea que el ESP32 tenga (editado desde la web).
 * Provee métodos para comparar, push, pull y detectar inconsistencias.
 */
@Injectable()
export class DeviceSettingsService {
  private readonly logger = new Logger(DeviceSettingsService.name);

  constructor(
    @InjectRepository(DeviceSettingsEntity)
    private readonly settingsRepository: Repository<DeviceSettingsEntity>,
    @InjectRepository(DevicesEntity)
    private readonly deviceRepository: Repository<DevicesEntity>,
    @Inject(forwardRef(() => MqttService))
    private readonly mqttService: wrapperType.WrapperType<MqttService>,
    //private readonly websocketsGateway: WebsocketsGateway,
  ) {}

  // ─────────────────────────────────────────────────
  //  LECTURA
  // ─────────────────────────────────────────────────

  /**
   * @description Obtiene el registro de settings de un dispositivo por su UUID.
   * Si no existe, retorna un objeto vacío con isSynced = false.
   * @param {string} deviceId - UUID del dispositivo.
   * @returns {Promise<DeviceSettingsEntity | null>}
   */
  public async getSettingsByDeviceId(
    deviceId: string,
  ): Promise<DeviceSettingsEntity | null> {
    return this.settingsRepository.findOne({
      where: { device: { id: deviceId } },
      relations: { device: true },
    });
  }

  // ─────────────────────────────────────────────────
  //  ESCRITURA DESDE EL DISPOSITIVO (Device → Cloud)
  // ─────────────────────────────────────────────────

  /**
   * @description Crea o actualiza el `deviceData` cuando el ESP32 reporta su configuración.
   * Recalcula automáticamente el flag `isSynced` comparando con `platformData`.
   * Utiliza una única consulta con JOIN para máxima eficiencia.
   * @param {string} deviceSerial - Serial del dispositivo (MAC).
   * @param {Record<string, any>} settingsData - JSON completo de configuración del ESP32.
   * @returns {Promise<DeviceSettingsEntity | null>} Registro actualizado.
   */
  public async upsertDeviceData(
    deviceSerial: string,
    settingsData: Record<string, any>,
  ): Promise<DeviceSettingsEntity | null> {
    // 1. Buscar dispositivo y sus settings en un solo query | Single query join
    const device = await this.deviceRepository.findOne({
      where: { deviceSerial },
    });

    if (!device) {
      this.logger.warn(
        `[Settings Sync] Dispositivo con serial "${deviceSerial}" no encontrado`,
      );
      return null;
    }

    let settings = await this.settingsRepository.findOne({
      where: { device: { id: device.id } },
      relations: { device: true },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        device,
        deviceData: settingsData,
        platformData: JSON.parse(JSON.stringify(settingsData)),
        isSynced: true,
        lastDeviceReport: new Date(),
      });
    } else {
      settings.deviceData = settingsData;
      settings.lastDeviceReport = new Date();

      if (!settings.platformData) {
        settings.platformData = JSON.parse(JSON.stringify(settingsData));
      }
    }

    settings.isSynced = this.compareSettings(
      settings.deviceData,
      settings.platformData,
    );
    const saved = await this.settingsRepository.save(settings);

    // Notificar vía WS
    /* this.websocketsGateway.sendMessageWs({
      device_serial: deviceSerial,
      type: 'settings_report',
      settings: saved,
    }); */

    return saved;
  }

  // ─────────────────────────────────────────────────
  //  ESCRITURA DESDE LA PLATAFORMA (Cloud → Device)
  // ─────────────────────────────────────────────────

  /**
   * @description Actualiza la configuración deseada desde la plataforma web.
   * Marca `isSynced = false` hasta que se reciba confirmación del dispositivo.
   * @param {string} deviceId - UUID del dispositivo objetivo.
   * @param {Record<string, any>} platformData - JSON con la configuración editada por el usuario.
   * @returns {Promise<DeviceSettingsEntity>} Entidad actualizada.
   * @throws {HttpException} 404 si el dispositivo no existe.
   */
  public async updatePlatformData(
    deviceId: string,
    platformData: Record<string, any>,
  ): Promise<DeviceSettingsEntity> {
    // Intentar obtener settings con el device cargado de una vez | Single join query
    let settings = await this.settingsRepository.findOne({
      where: { device: { id: deviceId } },
      relations: { device: true },
    });

    if (!settings) {
      // Si no hay settings, verificamos que el dispositivo exista
      const device = await this.deviceRepository.findOne({
        where: { id: deviceId },
      });
      if (!device) {
        throw new HttpException(
          `Dispositivo con Id "${deviceId}" no encontrado`,
          HttpStatus.NOT_FOUND,
        );
      }
      settings = this.settingsRepository.create({
        device,
        deviceData: undefined,
        platformData,
        isSynced: false,
      });
    } else {
      settings.platformData = platformData;
      settings.isSynced = this.compareSettings(
        settings.deviceData,
        settings.platformData,
      );
    }

    return this.settingsRepository.save(settings);
  }

  // ─────────────────────────────────────────────────
  //  ACCIONES MQTT (Push / Pull / Restart / Restore)
  // ─────────────────────────────────────────────────

  /**
   * @description Envía la configuración `platformData` al ESP32 vía MQTT.
   * Publica en el tópico de comandos del dispositivo con la acción correspondiente.
   * @param {string} deviceId - UUID del dispositivo.
   * @param {'update_wifi' | 'update_mqtt' | 'update_time'} action - Tipo de actualización.
   * @returns {Promise<{ status: boolean; message: string }>}
   */
  public async pushToDevice(
    deviceId: string,
    action: 'update_wifi' | 'update_mqtt' | 'update_time',
  ): Promise<{ status: boolean; message: string }> {
    const settings = await this.settingsRepository.findOne({
      where: { device: { id: deviceId } },
      relations: {
        device: {
          createUserId: true,
        },
      },
    });

    if (!settings) {
      throw new HttpException(
        'Configuración del dispositivo no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!settings.platformData) {
      throw new HttpException(
        'No hay datos de la plataforma para enviar',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Extraer la sección de datos relevante del platformData
    const sectionMap: Record<string, string> = {
      update_wifi: 'wifi',
      update_mqtt: 'mqtt',
      update_time: 'time',
    };

    const section = sectionMap[action];
    const dataToSend = settings.platformData[section] || {};

    // Construir tópico de comando basado en el deviceData (si existe) o un patrón por defecto
    const commandTopic = this.resolveCommandTopic(settings);

    const payload = JSON.stringify({
      action,
      data: dataToSend,
    });

    const mqttClient = this.mqttService.getMqttClientById('emqx');

    if (!mqttClient) {
      throw new HttpException(
        'MQTT client not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    await this.mqttService.doPublish(mqttClient, commandTopic, 0, payload);

    // Actualizar timestamp del último push
    settings.lastPlatformPush = new Date();

    await this.settingsRepository.save(settings);

    return {
      status: true,
      message: `Acción "${action}" enviada al dispositivo "${settings.device.deviceSerial}"`,
    };
  }

  /**
   * @description Solicita al ESP32 que reenvíe su configuración actual vía MQTT.
   * @param {string} deviceId - UUID del dispositivo.
   * @returns {Promise<{ status: boolean; message: string }>}
   */
  public async requestDeviceReport(
    deviceId: string,
  ): Promise<{ status: boolean; message: string }> {
    return this.sendAction(deviceId, 'request_settings');
  }

  // ─────────────────────────────────────────────────
  //  UTILIDADES PRIVADAS
  // ─────────────────────────────────────────────────

  /**
   * @description Orquesta el despacho de una acción genérica mediante MQTT.
   * Optimiza el flujo de datos buscando Device y Settings bajo una sola relación.
   * @param {string} deviceId - UUID del objetivo.
   * @param {string} action - Comando (restart, restore, etc).
   * @param {Record<string, any>} [data] - (Opcional) Metadata extra.
   * @returns {Promise<{ status: boolean; message: string }>} Feedback de comando enviado.
   */
  private async sendAction(
    deviceId: string,
    action: string,
    data?: Record<string, any>,
  ): Promise<{ status: boolean; message: string }> {
    // Intento de búsqueda unificada | Single Join query attempt
    const settings = await this.settingsRepository.findOne({
      where: { device: { id: deviceId } },
      relations: {
        device: {
          createUserId: true,
        },
      },
    });

    if (settings?.device) {
      return this.publishCommand(settings.device, action, data);
    }

    // Si no hay settings vinculados, buscar el dispositivo huérfano
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
      relations: { createUserId: true },
    });

    if (!device) {
      throw new HttpException(
        `Dispositivo con Id "${deviceId}" no encontrado`,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.publishCommand(device, action, data);
  }

  /**
   * @description Compara dos JSONs de configuración campo a campo (superficial).
   * Ignora campos de passwords (que contienen "***") y campos de solo lectura.
   * @param {Record<string, any>} deviceData - Config reportada por el ESP32.
   * @param {Record<string, any>} platformData - Config deseada desde la web.
   * @returns {boolean} True si son equivalentes (sincronizados).
   */
  private compareSettings(
    deviceData: Record<string, any> | null,
    platformData: Record<string, any> | null,
  ): boolean {
    // Si alguno es null, no están sincronizados
    if (!deviceData || !platformData) return false;

    // Campos que se ignoran en la comparación
    const ignoredKeys = new Set([
      'wifi_password',
      'ap_password',
      'mqtt_password',
      'mqtt_cert',
      'device_id',
      'device_name',
    ]);

    // Comparar cada sección (wifi, mqtt, time)
    const sections = ['wifi', 'mqtt', 'time'];

    for (const section of sections) {
      const deviceSection = deviceData[section];
      const platformSection = platformData[section];

      if (!deviceSection && !platformSection) continue;
      if (!deviceSection || !platformSection) return false;

      // Comparar campos dentro de cada sección
      const allKeys = new Set([
        ...Object.keys(deviceSection),
        ...Object.keys(platformSection),
      ]);

      for (const key of allKeys) {
        if (ignoredKeys.has(key)) continue;

        if (
          JSON.stringify(deviceSection[key]) !==
          JSON.stringify(platformSection[key])
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @description Resuelve el tópico de comandos dinámicamente.
   * Si el device reportó sus settings (incluyendo mqtt_commandTopic), lo usa.
   * Si no, construye un tópico por convención.
   * @param {DeviceSettingsEntity} settings - Entidad de settings con device cargado.
   * @returns {string} Tópico de comando MQTT.
   */
  private resolveCommandTopic(settings: DeviceSettingsEntity): string {
    // Intentar usar el tópico configurado en el dispositivo
    const configuredTopic = settings.deviceData?.mqtt?.mqtt_commandTopic;
    if (
      configuredTopic &&
      typeof configuredTopic === 'string' &&
      configuredTopic.length > 0
    ) {
      return configuredTopic;
    }

    // Fallback: construir por convención
    const username = settings.device?.createUserId?.username || 'emqx';

    return `/${username}/esp32/${settings.device.deviceSerial}/command`;
  }

  /**
   * @description Publica un comando MQTT al tópico de commands del dispositivo.
   * @param {DevicesEntity} device - Entidad del dispositivo con su usuario creador.
   * @param {string} action - Acción a ejecutar.
   * @param {Record<string, any>} [data] - Datos a enviar junto con la acción.
   * @returns {Promise<{ status: boolean; message: string }>}
   */
  private async publishCommand(
    device: DevicesEntity,
    action: string,
    data?: Record<string, any>,
  ): Promise<{ status: boolean; message: string }> {
    const mqttClient = this.mqttService.getMqttClientById('emqx');
    if (!mqttClient) {
      throw new HttpException(
        'Cliente MQTT no disponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Construir tópico de comando: /{username}/esp32/{serial}/command
    const username = device.createUserId?.username || 'emqx';
    const commandTopic = `/${username}/esp32/${device.deviceSerial}/command`;

    const payload: any = { action };
    if (data) {
      payload.data = data;
    }

    await this.mqttService.doPublish(
      mqttClient,
      commandTopic,
      0,
      JSON.stringify(payload),
    );

    this.logger.log(
      `[Settings Sync] Acción "${action}" publicada al "${commandTopic}"`,
    );

    return {
      status: true,
      message: `Acción "${action}" enviada al dispositivo "${device.deviceSerial}"`,
    };
  }

  /**
   * @description Maneja la solicitud de sincronización iniciada por el dispositivo (get_settings).
   * Recupera la configuración actual de la plataforma en UNA sola consulta y la reenvía al ESP32.
   * @param {string} deviceSerial - Serial unívoco del hardware.
   * @returns {Promise<void>} Operación asíncrona MQTT-side.
   */
  public async handleDeviceSyncRequest(deviceSerial: string): Promise<void> {
    // Obtenemos Device y Settings vinculados en un solo JOIN | Single query optimization
    const settings = await this.settingsRepository.findOne({
      where: { device: { deviceSerial } },
      relations: {
        device: {
          createUserId: true,
        },
      },
    });

    if (!settings || !settings.device) {
      this.logger.warn(
        `[Settings Sync] Solicitud de sincronización de un dispositivo sin configuración o desconocido: ${deviceSerial}`,
      );
      return;
    }

    if (!settings.platformData) {
      this.logger.log(
        `[Settings Sync] Device "${deviceSerial}" Se han solicitado los ajustes, pero platformData está vacío.`,
      );
      return;
    }

    const payload = JSON.stringify({
      action: 'settings_data',
      type: 'settings_report',
      device_serial: deviceSerial,
      settings: settings.platformData,
    });

    const username = settings.device.createUserId?.username || 'emqx';
    const commandTopic = `/${username}/esp32/${deviceSerial}/command`;

    const mqttClient = this.mqttService.getMqttClientById('emqx');
    if (mqttClient) {
      await this.mqttService.doPublish(mqttClient, commandTopic, 0, payload);
      this.logger.log(
        `[Settings Sync] Se ha enviado la respuesta settings_data al dispositivo. "${deviceSerial}"`,
      );
    }
  }

  /**
   * @description Maneja la solicitud de descarga de certificado CA (get_certificate).
   * Lee el archivo cacert.pem del sistema de archivos y lo envía al dispositivo.
   * @param deviceSerial - Serial del dispositivo.
   * @returns Promise<void>
   */
  public async handleCertificateRequest(deviceSerial: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { deviceSerial },
      relations: { createUserId: true },
    });

    if (!device) {
      this.logger.warn(
        `[Cert Request] Received request from unknown device: ${deviceSerial}`,
      );
      return;
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const certPath = path.resolve(process.cwd(), 'certs', 'cacert.pem');

      if (!fs.existsSync(certPath)) {
        this.logger.error(
          `[Cert Request] cacert.pem not found at: ${certPath}`,
        );
        return;
      }

      const certContent = fs.readFileSync(certPath, 'utf8');

      const payload = JSON.stringify({
        action: 'certificate_data',
        device_serial: deviceSerial,
        cert: certContent,
      });

      const username = device.createUserId?.username || 'emqx';
      const commandTopic = `/${username}/esp32/${deviceSerial}/command`;

      const mqttClient = this.mqttService.getMqttClientById('emqx');
      if (mqttClient) {
        await this.mqttService.doPublish(mqttClient, commandTopic, 0, payload);
        this.logger.log(
          `[Cert Request] Sent certificate_data to device "${deviceSerial}"`,
        );
      } else {
        this.logger.error(`[Cert Request] MQTT client 'emqx' not available.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `[Cert Request] Error reading or sending certificate: ${message}`,
      );
    }
  }
}
