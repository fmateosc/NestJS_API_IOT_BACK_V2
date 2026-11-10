// src/modules/devices/entities/devices.entity.ts

import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../config/base.entity.js';
import { DEVICE_TYPES } from '../../../constants/devices-types.js';
import { UsersEntity } from '../../users/entities/users.entity.js';
import type { Relation } from 'typeorm';

/**
 * @description Entidad principal de la base de datos (Tabla `devices`).
 * Representa a nivel relacional el Hardware físico IoT vinculado al ecosistema,
 * conteniendo metadata de rastreo, conectividad y configuraciones transitorias.
 */
@Entity({ name: 'devices' })
export class DevicesEntity extends BaseEntity {
  /** @Column {DEVICE_TYPES} Enum limitando las arquitecturas permitidas (Ej. ESP32, ESP8266). */
  @Column({
    type: 'enum',
    enum: DEVICE_TYPES,
    default: 'ESP32',
  })
  deviceType: DEVICE_TYPES;

  /** @Column {string} Alias humano del equipo. */
  @Column('text', { nullable: false })
  deviceName: string;

  /** @Column {string} Serial único (MAC/Hardware-ID) dictando el topic principal en MQTT. */
  @Column('text', { nullable: false, unique: true })
  deviceSerial: string;

  @Column('text', { nullable: true })
  deviceDescription: string;

  /** @Column {string} Ubicación satelital u opcional para mapas. */
  @Column('jsonb', { nullable: true })
  deviceLocation: { longitude: number; latitude: number };

  /** @Column {string} UUID retornado por EMQX tras montar el Data Bridge. */
  @Column('text', { nullable: true })
  bridgeRuleId: string;
  /** @Column {boolean} Flag bidireccional indicando si el Bridge EMQX está enviando telemetría o no. */
  @Column('bool', { nullable: true })
  bridgeRuleEnabled: boolean;

  /** @Column {boolean} Flag pasivo (Online/Offline) manipulado reactivamente por webhooks o ping del broker MQTT. */
  @Column('bool', { default: false })
  deviceOnline: boolean;

  /** @Column {boolean} Flag de Tenant para soft delete o baneo. Si es False, el cliente no conecta (Emqx Banned). */
  @Column('bool', { default: true })
  deviceStatus: boolean;

  /** @Column {Date} Marca de tiempo inyectada por el broker marcando la última interacción eléctrica certificada. */
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  deviceLastseen: Date;

  /** @Relation ManyToOne atando Múltiples dispositivos a 1 Único dueño (Usuario). (Ondelete CASCADE Macro purge). */
  @ManyToOne('UsersEntity', (user: UsersEntity) => user.userDevices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'device_user_id' })
  createUserId: Relation<UsersEntity>;
}
