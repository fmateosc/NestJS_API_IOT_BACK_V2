// src/modules/messages/controllers/messages.controllers.ts

import { Body, Controller, Logger, Post } from '@nestjs/common';
import type { IMqttMessage } from '../interfaces/mqtt.interface.js';
import { MessagesService } from '../services/messages.service.js';

@Controller('messages')
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private readonly messageService: MessagesService,
    // websockets
    //private readonly webscoketsGateway: WebsocketsGateway,
  ) {}

  @Post('register')
  public async createNewMessage(@Body() newMessageData: IMqttMessage) {
    // La orquestación de actualización de conexión y persistencia se delega al servicio (Fase 4: SOLID)
    await this.messageService.registerMessage(newMessageData);

    this.logger.debug('Message received from MQTT');
    this.logger.debug(newMessageData);

    // TODO: Publicar por websockets para actualización en tiempo real del dashboard
  }
}
