// src/modules/messages/services/messages.service.ts

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DevicesService } from '../../devices/services/devices.service.js';
import { MessageEntity } from '../entities/message.entity.js';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(forwardRef(() => DevicesService))
    private readonly deviceService: DevicesService,

    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {}

  /**
   * @description Hook interceptor interno que analiza los payloads entrantes del Broker MQTT
   * para inferir inteligentemente si el dispositivo está Vivo o Muerto (Online/Offline) basado en su transmisión.
   * @param {any} newMessageData - JSON emitido por la regla Webhook de EMQX.
   * @returns {Promise<void>} Operación silente Background.
   */
  public async updateDeviceConnection(newMessageData: any): Promise<void> {
    let isConnected = true;

    const deviceSerial = newMessageData.topic?.split('/').filter(Boolean)[2];

    // Si es el tópico de status explícito, leemos el payload. Si es de device, asumimos true porque transmitió biometría o estado.
    if (newMessageData.topic && newMessageData.topic.endsWith('/status')) {
      const status: { connected: boolean } = JSON.parse(newMessageData.payload);

      isConnected = status.connected;
    }

    await this.deviceService.updateDeviceConnection(deviceSerial, isConnected);
  }

  /**
   * @description Inyector de Telemetría Core del sistema. Orquesta la recepción de datagramas
   * desde EMQX, dispara la actualización de latidos (Heartbeat) y persiste la serie de tiempo.
   * Funciona como el "Single Entry Point" para todos los mensajes entrantes de los dispositivos.
   * @param {any} newMessageData - Objeto crudo emitido por el Broker MQTT.
   * @returns {Promise<void>} Operación asíncrona de fondo.
   */
  public async registerMessage(newMessageData: any): Promise<void> {
    // 1. Analizar e Inferir Conectividad (Background) - Siempre se intenta actualizar el estado Online/Offline
    await this.updateDeviceConnection(newMessageData);

    // 2. Persistir Serie de Tiempo (Telemetry) - Solo si el tópico es de tipo /device
    if (newMessageData.topic && newMessageData.topic.endsWith('/device')) {
      try {
        const payload =
          typeof newMessageData.payload === 'string'
            ? JSON.parse(newMessageData.payload)
            : newMessageData.payload;

        const messageEntity = this.messageRepository.create({
          qos: newMessageData.qos,
          topic: newMessageData.topic,
          clientid: newMessageData.clientid,
          username: newMessageData.username,
          event: newMessageData.event,
          id_message: newMessageData.id,
          payload: payload,
        });

        await this.messageRepository.save(messageEntity);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Error al guardar la telemetría del cliente. ${newMessageData.clientid}: ${message}`,
        );
      }
    }
  }
}
