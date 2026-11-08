// src/modules/users/dtos/update.password.user.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * @description Estructura DTO dedicada a la validación en tránsito de la rotación de credenciales.
 * Asegura forzosamente el cumplimiento de las políticas de contraseñas robustas antes de llegar al servicio.
 */
export class PasswordUserDto {
  @ApiProperty({
    description: 'The current password of the user',
    example: 'OldP@ssw0rd123*',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(
    /(?=(.*[0-9]))(?=.*[\!@#$%^&*()\\[\]{}\-_+=|:;"'<>,./?])(?=.*[a-z])(?=(.*[A-Z]))(?=(.*)).{8,20}/,
    {
      message:
        'La contraseña anterior debe tener una letra minúscula, una letra mayúscula, un número, un carácter especial y al menos 8 dígitos',
    },
  )
  currentpwd?: string;

  @ApiProperty({
    description: 'The new secure password',
    example: 'NewP@ssw0rd123*',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(
    /(?=(.*[0-9]))(?=.*[\!@#$%^&*()\\[\]{}\-_+=|:;"'<>,./?])(?=.*[a-z])(?=(.*[A-Z]))(?=(.*)).{8,20}/,
    {
      message:
        'La nueva contraseña debe tener una letra minúscula, una letra mayúscula, un número, un carácter especial y al menos 8 dígitos',
    },
  )
  newpwd?: string;

  @ApiProperty({
    description: 'The confirmation of the new password',
    example: 'NewP@ssw0rd123*',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(
    /(?=(.*[0-9]))(?=.*[\!@#$%^&*()\\[\]{}\-_+=|:;"'<>,./?])(?=.*[a-z])(?=(.*[A-Z]))(?=(.*)).{8,20}/,
    {
      message:
        'La confirmación debe tener una letra minúscula, una letra mayúscula, un número, un carácter especial y al menos 8 dígitos',
    },
  )
  confirmpwd?: string;
}
