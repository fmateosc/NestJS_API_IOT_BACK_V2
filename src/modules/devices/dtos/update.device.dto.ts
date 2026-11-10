import { PartialType } from '@nestjs/swagger';
import { DeviceDto } from './devices.dto.js';

/**
 * @description DTO parcial para estructurar las cargas útiles (payloads) de actualización de un dispositivo.
 * Infiere y transita la superficialidad (Opcional) de todas las reglas del `DeviceDto` maestro.
 */
export class UpdateDeviceDto extends PartialType(DeviceDto) {}
