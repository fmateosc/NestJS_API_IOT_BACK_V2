// src/modules/schedules/task/dtos/task.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  IsObject,
} from 'class-validator';

/**
 * @description DTO central de validación para la creación de Tareas CRON.
 * Controla fuertemente los esquemas de entrada previniendo inyección de datos impuros.
 */
export class TaskDto {
  /**
   * @description Identificador humano amigable.
   */
  @ApiProperty({
    description: 'A friendly name for the scheduled task',
    example: 'Relay1 false 2',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * @description Estado activo / inactivo de la programación.
   */
  @ApiProperty({
    description: 'Active or inactive status of the task',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  status: boolean;

  /**
   * @description Días de la semana. [ "0", "1", "2" ] (ej. 0=Domingo, 1=Lunes).
   */
  @ApiProperty({
    description: 'Days of the week to run the task',
    example: ['all'],
  })
  @IsArray()
  @IsNotEmpty()
  days: string[];

  /**
   * @description Hora y Minuto exacto. Regex controla formato HH:mm (24h).
   */
  @ApiProperty({
    description: 'Specific time in HH:mm (24h) format',
    example: '22:45',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'The time format must be HH:mm in 24h' })
  time: string; // Hora en formato HH:mm (24h)

  /**
   * @description TimeZone de IANA DB para adaptar el gatillo a la región del usuario final.
   */
  @ApiProperty({
    description: 'IANA time zone for local time execution',
    example: 'America/La_Paz',
    required: false,
  })
  @IsString()
  @IsOptional()
  timeZone?: string; // Agregar esta propiedad

  /**
   * @description Topic MQTT base. Internamente se aislará agregando `/Username/...` al principio.
   */
  @ApiProperty({
    description: 'MQTT command topic',
    example: 'esp32/ESP32DC15B80C703E/command',
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  /**
   * @description Estructura polimórfica JSON. Los actuadores reciben estos pares Clave/Valor.
   */
  @ApiProperty({
    description: 'Generic JSON object containing actuator commands',
    example: {
      protocol: 'API',
      output: 'RELAY1',
      value: false,
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  command?: { [key: string]: any }; // Objeto JSON genérico
}
