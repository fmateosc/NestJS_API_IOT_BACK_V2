// src/modules/devices/services/devices.dto.ts

import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DEVICE_TYPES } from '../../../constants/devices-types.js';
import { ApiProperty } from '@nestjs/swagger';

/**
 * @description Estructura de Transferencia de Datos (DTO) para la creación base de un Dispositivo.
 * Define las validaciones de entrada permitidas por el pipe Validation de NestJS.
 */
export class DeviceDto {
  @IsOptional()
  @IsEnum(DEVICE_TYPES)
  deviceType?: DEVICE_TYPES;

  /** @property {string} deviceName - Nombre humano otorgado (Alias) ej. "Bomba Sector 1". */
  @ApiProperty({
    description: 'A human-readable name for the device',
    example: 'ESP32 CLOUD',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  deviceName: string;

  /** @property {string} deviceSerial - Cadena unívoca/firmware o MAC que vincula MQTT al DB (Ej: ESP32ABC123). */
  @ApiProperty({
    description: 'The unique serial number or MAC address of the device',
    example: 'ESP32DC15B80C703E',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  deviceSerial: string;

  @ApiProperty({
    description: 'A brief explanation of the device purpose or location',
    example: 'Dispositivo ESP32 CLOUD',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceDescription?: string;

  @IsOptional()
  deviceLocation?: { longitude: number; latitude: number };

  @IsOptional()
  @IsString()
  @MaxLength(50)
  /** @property {string} bridgeRuleId - ID devuelto por EMQX tras provisionarlo en el motor de REGLAS y BRIDGES. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bridgeRuleId?: string;

  /** @property {boolean} bridgeRuleEnabled - Bandera espejo que mantiene sync el DB local con el on/off del Forwarder EMQX. */
  @IsOptional()
  @IsBoolean()
  bridgeRuleEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  deviceOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  deviceStatus?: boolean;

  @IsOptional()
  @IsDate()
  deviceLastseen?: Date;

  @IsOptional()
  settingsData?: any;
}
