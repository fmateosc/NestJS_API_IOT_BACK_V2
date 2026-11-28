// src/modules/schedules/task/dtos/update.task.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { TaskDto } from './task.dto.js';

/**
 * @description DTO para la actualización parcial de una Tarea Programada.
 * Hereda todas las propiedades de TaskDto marcándolas como opcionales.
 */
export class UpdateTaskDto extends PartialType(TaskDto) {}
