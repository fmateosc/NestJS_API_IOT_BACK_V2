// src/modules/messages/services/message.entity.ts

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../config/base.entity.js';

/**
 * @description Entidad encargada de representar el Histórico Físico de todos los Datagramas operando bajo MQTT.
 * Almacena en crudo (JSONB) las telemetrías originadas por las reglas del Broker EMQX.
 */
@Entity({ name: 'messages' })
@Index(['clientid', 'createdAt'])
export class MessageEntity extends BaseEntity {
  /** @Column {number} Calidad de Servicio del mensaje MQTT (0, 1, 2). */
  @Column('int')
  qos: number;

  /** @Column {string} Tópico de destino en el Broker donde se publicó originariamente. */
  @Column('text')
  topic: string;

  /** @Column {string} Identificador EMQX Único del Productor (Por lo general Device Serial). */
  @Column('text')
  @Index()
  clientid: string;

  /** @Column {string} (Opcional) Usuario MQTT que autenticó la subida. */
  @Column('text', { nullable: true })
  username: string;

  /** @Column {string} (Opcional) Metadata identificando la Regla origen. */
  @Column('text', { nullable: true })
  event: string;

  /** @Column {string} ID Hash Único interno de EMQX emitido para rastreo en su Dashboard (Message Tracking). */
  @Column('text')
  id_message: string;

  /** @Column {Record<string, any>} Payload del dispositivo parseado flexiblemente en JSONB (Indexable nativamente por Postgres). */
  @Column('jsonb')
  payload: Record<string, any>;
}
