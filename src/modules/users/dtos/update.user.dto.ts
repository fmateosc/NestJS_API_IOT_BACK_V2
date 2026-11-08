// src/modules/users/dtos/update.user.dto.ts

import { PartialType } from '@nestjs/swagger';
import { UserDto } from './user.dto.js';

/**
 * @description DTO parcial para estructurar las cargas útiles (payloads) de actualización de un usuario.
 * Hereda opcionalmente las reglas de validación de UserDto.
 */
export class UpdateUserDto extends PartialType(UserDto) {}
