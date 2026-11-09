// src/modules/auth/entities/acl.entity.ts

import { BaseEntity } from '../../../config/base.entity.js';
import { ACL_ACTION, ACL_PERMISSION } from '../../../constants/acl.js';
import type { UsersEntity } from '../../users/entities/users.entity.js';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

/**
 * @description Entidad encargada de representar las Reglas Funcionales de Control de Acceso (ACL)
 * inyectadas directamente al Broker EMQX a través del Auth Plugin de PostgreSQL.
 * Controla quién puede Suscribirse o Publicar en qué Tópicos.
 */
@Entity({ name: 'acl' })
export class AclEntity extends BaseEntity {
  /** @Column {string} Restricción opcional por Dirección IPv4/IPv6. */
  @Column('text', {
    nullable: true,
    default: '',
  })
  ipaddress: string;

  /** @Column {string} Nombre de Usuario MQTT vinculado a esta regla. */
  @Column('text', {
    nullable: true,
    default: '',
  })
  username: string;

  /** @Column {string} Opcional, match por ID de Cliente (Device Serial). */
  @Column('text', {
    nullable: true,
    default: '',
  })
  clientid: string;

  /** @Column {ACL_ACTION} Tipo de Operación restringida (publish, subscribe, all). */
  @Column({ type: 'enum', enum: ACL_ACTION })
  action: ACL_ACTION;

  /** @Column {ACL_PERMISSION} Decisión del ACL (allow, deny). */
  @Column({ type: 'enum', enum: ACL_PERMISSION })
  permission: ACL_PERMISSION;

  /** @Column {string} Filtro de Enrutamiento del Tópico a proteger (Ej. +/#, /data/topic). */
  @Column('text', {
    nullable: false,
  })
  topic: string;

  @Column({ type: 'smallint' }) // 0, 1, 2
  qos: number;

  @Column({ type: 'smallint' }) // 0, 1
  retain: number;

  // users relationship
  @ManyToOne('UsersEntity', (user: UsersEntity) => user.aclRules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'create_user_id' })
  createUserId: Relation<UsersEntity>;
}
