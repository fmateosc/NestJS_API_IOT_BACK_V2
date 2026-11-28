// src/modules/schedules/task/entities/task.entity.ts

import * as typeorm from 'typeorm';
import { BaseEntity } from '../../../../config/base.entity.js';
import { UsersEntity } from '../../../users/entities/users.entity.js';

/**
 * @description Entidad de Base de Datos para las Tareas Programadas (CronJobs).
 * Almacena la configuración de ejecución, el tópico MQTT de destino y el comando a publicar.
 */
@typeorm.Entity({ name: 'task' })
export class TaskEntity extends BaseEntity {
  /**
   * @description Nombre descriptivo de la tarea.
   */
  @typeorm.Column('text', { unique: true, nullable: false })
  name: string;

  /**
   * @description Estado de activación de la tarea (true: activa, false: inactiva).
   */
  @typeorm.Column({ type: 'boolean' })
  status: boolean;

  /**
   * @description Arreglo de días de la semana en los que se ejecuta (ej. ['1', '2'] para Lunes y Martes).
   */
  @typeorm.Column({
    type: 'text',
    array: true,
    default: [],
  })
  days: string[];

  /**
   * @description Hora de ejecución en formato de 24 horas ('HH:mm').
   */
  @typeorm.Column({ type: 'varchar', length: 255 })
  time: string; // Almacena la hora en formato 'HH:mm'

  /**
   * @description Zona horaria IANA para la ejecución precisa (ej. 'America/Guayaquil').
   */
  @typeorm.Column({ nullable: true })
  timeZone?: string; // Agregar esta propiedad

  /**
   * @description Tópico MQTT al cual se publicará el comando cuando se dispare la tarea.
   */
  @typeorm.Column({ type: 'varchar', length: 255 })
  topic: string;

  /**
   * @description Payload JSON que se enviará por MQTT. Puede contener booleanos o valores numéricos.
   */
  @typeorm.Column({ type: 'jsonb', nullable: true }) // Cambiar a tipo jsonb
  command: { [key: string]: boolean | number }; // Almacena objetos JSON como {"output1": true} o {"dimmer1": 100}

  /**
   * @description Relación al usuario creador de la tarea. La eliminación del usuario en cascada elimina la tarea.
   */
  @typeorm.ManyToOne('UsersEntity', (user: UsersEntity) => user.userTask, {
    onDelete: 'CASCADE',
  })
  @typeorm.JoinColumn({ name: 'task_user_id' })
  createUserId: typeorm.Relation<UsersEntity>;
}
