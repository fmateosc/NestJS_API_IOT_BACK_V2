// src/modules/auth/dtos/auth.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthBody } from '../intefaces/auth.interface.js';
/**
 * @description DTO Simplificado para la recepción exclusiva de credenciales durante el Login.
 * Transfiere la responsabilidad de comprobaciones de seguridad complejas al AuthService.
 */
export class AuthDto implements AuthBody {
  /** @property {string} username - Literal string proviniendo del Input Login. */
  @ApiProperty({
    description: 'The unique username of the user',
    example: 'emqx',
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  /** @property {string} password - Crudo string proviniendo del Input Password Mapped. */
  @ApiProperty({
    description: 'The secure password of the user',
    example: 'Password123*',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
