// src/modules/settings/entities/settings.entity.ts

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../config/base.entity.js';
import { EncryptionTransformer } from '../transformers/encryption.transformer.js';

@Entity({ name: 'general_settings' })
export class GeneralSettingsEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, default: 'Atlantic/Canary' })
  timezone: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    transformer: new EncryptionTransformer(),
  })
  emqxApiKey: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    transformer: new EncryptionTransformer(),
  })
  emqxApiSecretKey: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: 'localhost',
  })
  emqxAppHost: string;

  @Column({ type: 'int', nullable: true, default: 18083 })
  emqxAppPort: number;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'emqx' })
  mqttApiUser: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: 'User123*+-',
    transformer: new EncryptionTransformer(),
  })
  mqttApiPassword: string;

  @Column({ type: 'int', nullable: true, default: 1883 })
  mqttApiPort: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: 'localhost',
  })
  apiCoreHost: string;

  @Column({ type: 'int', nullable: true, default: 3000 })
  apiCorePort: number;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    transformer: new EncryptionTransformer(),
  })
  telegramBotToken: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    default: 'mail.tudominio.com',
  })
  smtpHost: string;

  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    default: 'email@tudominio.com',
  })
  smtpUser: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    default: 'Password123*',
    transformer: new EncryptionTransformer(),
  })
  smtpPassword: string;

  @Column({ type: 'int', nullable: true, default: 465 })
  smtpPort: number;

  @Column({ type: 'boolean', nullable: true, default: true })
  smtpSecure: boolean;
}
