// src/modules/users/entities/users.entity.ts

import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../config/base.entity.js';
import { ACCESS_LEVEL, USER_ORIGIN } from '../../../constants/index.js';
import { AclEntity } from '../../auth/entities/acl.entity.js';
//import { AclEntity } from '../../auth/entities/acl.entity.js';
//import { DevicesEntity } from '../../devices/entities/devices.entity.js';
//import { TaskEntity } from '../../schedules/task/entities/task.entity.js';

/**
 * @description Entidad Primaria y Core de Autenticación (`mqtt_user` o `users`).
 * Almacena las credenciales encriptadas (Bcrypt), estado del 2FA, tokens de recuperación y relaciones
 * fuertes en Cascada (Dueño de ACLs, Devices y Tasks).
 */

/**
 * @IMPORTANTE Eliminar las columnas que no son necesarias para una api que no sea para EMQX.
 */

@Entity({ name: 'users' })
export class UsersEntity extends BaseEntity {
  /** @Column {string} Nombre de Usuario único (Login Credential Principal). */
  @Column('text', {
    unique: true,
    nullable: false,
  })
  username: string;

  /** @Column {string} Hash Bcrypt Salteado. (Oculto en selectores por defecto por Seguridad). */
  @Column('text', {
    select: false,
    nullable: false,
  })
  password: string;

  /** @Column {ACCESS_LEVEL} Nivel de Acceso (Admin / Root). Root es SysAdmin Total. */
  @Column({
    type: 'enum',
    enum: ACCESS_LEVEL,
    default: ACCESS_LEVEL.ADMIN, // 'ADMIN'
    nullable: false,
  })
  userAccess: ACCESS_LEVEL;

  /** @Column {string} Nombre completo humano. */
  @Column('text', {
    nullable: true,
  })
  userFullName: string;

  /** @Column {string} Correo de validación y recuperación de clave. (Segundo factor de unicidad). */
  @Column('text', {
    unique: true,
    nullable: false,
  })
  userEmail: string;

  /** @Column {string} Salt criptográfico (Deprecado a favor del auto-salting de Bcrypt pero mantenido por compatibilidad EMQX). */
  @Column('text', {
    nullable: true,
    default: '',
  })
  salt: string;

  /** @Column {boolean} Flag EMQX Auth PostgreSQL: True = Total bypass de ACLs en MQTT. */
  @Column('bool', {
    default: false,
  })
  isSuperuser: boolean;

  /** @Column {string} Hash volátil para sesiones (No activo actualmente en JWT nativo, uso futuro). */
  @Column('text', {
    nullable: true,
    select: false,
  })
  userToken: string;

  /** @Column {boolean} Bandera de Conectividad a la interfaz Web. */
  @Column('bool', {
    default: false,
  })
  userLogin: boolean;

  /** @Column {boolean} Determina si el usuario pasó el desafío del correo electrónico. */
  @Column('bool', {
    default: false,
  })
  isVerified: boolean;

  /** @Column {string} Token en crudo de Registro (Quemar tras un solo uso). Oculto. */
  @Column('text', {
    nullable: true,
    select: false,
  })
  verificationToken: string;

  /** @Column {string} Token seguro (Un solo uso) linkeado al botón "Reset Password" del email. Oculto. */
  @Column('text', {
    nullable: true,
    select: false,
  })
  resetPasswordToken: string;

  // new feature 2FA
  @Column('bool', {
    default: false,
  })
  isTwoStepAuthEnabled: boolean;

  @Column('text', {
    nullable: true,
    select: false,
  })
  twoStepCode: string;

  @Column('timestamp', {
    nullable: true,
    select: false,
  })
  twoStepExpires: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  userLastseen: Date;

  @Column('bool', {
    default: true,
  })
  userStatus: boolean;

  @Column('text', {
    nullable: true,
    default: USER_ORIGIN.WEB,
  })
  userOrigin: string;

  // new update front
  @Column({ type: 'varchar', length: 100, default: 'Atlantic/Canary' })
  timezone: string;

  // acl
  @OneToMany(() => AclEntity, (acl) => acl.createUserId)
  aclRules: AclEntity[];

  // devices
  //@OneToMany(() => DevicesEntity, (device) => device.createUserId)
  //userDevices: DevicesEntity[];

  // task
  //@OneToMany(() => TaskEntity, (task) => task.createUserId)
  //userTask: TaskEntity[];
}
