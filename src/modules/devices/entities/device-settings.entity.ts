import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../config/base.entity.js';
import { DevicesEntity } from './devices.entity.js';

/**
 * @description Entidad de configuraciones almacenadas por dispositivo (Tabla `device_settings`).
 * Mantiene dos copias paralelas del JSON de configuración:
 * - `deviceData`: Snapshot de la configuración real reportada por el ESP32 vía MQTT.
 * - `platformData`: Configuración deseada editada desde la plataforma web.
 * El flag `isSynced` indica si ambas copias son consistentes entre sí.
 */
@Entity({ name: 'device_settings' })
export class DeviceSettingsEntity extends BaseEntity {
  /** @Column {jsonb} Configuración REAL reportada por el ESP32 (snapshot del settings.json del dispositivo). */
  @Column('jsonb', { nullable: true })
  deviceData: Record<string, any>;

  /** @Column {jsonb} Configuración DESEADA editada desde la plataforma web (cloud). */
  @Column('jsonb', { nullable: true })
  platformData: Record<string, any>;

  /** @Column {boolean} Flag de consistencia: true si deviceData y platformData son equivalentes. */
  @Column('bool', { default: false })
  isSynced: boolean;

  /** @Column {Date} Marca de tiempo del último reporte de settings recibido desde el dispositivo. */
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastDeviceReport: Date;

  /** @Column {Date} Marca de tiempo de la última vez que se envió configuración al dispositivo desde la plataforma. */
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastPlatformPush: Date;

  /** @Relation OneToOne vinculando esta configuración a un único dispositivo. (OnDelete CASCADE para purga automática). */
  @OneToOne(() => DevicesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: DevicesEntity;
}
