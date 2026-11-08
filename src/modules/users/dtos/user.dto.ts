// src/modules/users/dtos/user.dto.ts

import { ApiProperty, PickType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ACCESS_LEVEL } from '../../../constants/index.js';

/**
 * @description Data Transfer Object (DTO) maestro para la creación y validación de Usuarios.
 * Contiene reglas estrictas de Regex para contraseñas seguras y restricciones de formato para usernames.
 */

/**
 * @IMPORTANTE Eliminar las columnas que no son necesarias para una api que no sea para EMQX.
 */

export class UserDto {
  @ApiProperty({
    description: 'The unique ID of the user (UUID)',
    example: 'f3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3',
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  /** @property {string} username - Nombre de usuario alfanumérico en minúsculas (Mínimo 4 caracteres). */
  @ApiProperty({
    description: 'The unique username of the user',
    example: 'info',
    minLength: 4,
    maxLength: 16,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  @Matches(/^[a-z0-9]+$/, {
    // new update front
    message:
      'El nombre de usuario solo puede contener letras minúsculas y números',
  })
  username: string;

  /** @property {string} password - Contraseña cruda que será hasheada. Debe contener Mayúscula, Minúscula, Número y Carácter Especial. */
  @ApiProperty({
    description: 'The secure password of the user',
    example: 'User123*+-',
    minLength: 8,
    maxLength: 20,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(
    /(?=(.*[0-9]))(?=.*[\!@#$%^&*()\\[\]{}\-_+=|:;"'<>,./?])(?=.*[a-z])(?=(.*[A-Z]))(?=(.*)).{8,20}/,
    {
      message:
        'La contraseña debe contener al menos una letra minúscula, una letra mayúscula, un número, un carácter especial y tener entre 8 y 20 caracteres',
    },
  )
  password: string;

  /** @property {ACCESS_LEVEL} userAccess - Opcional. Forzado por el Backend a ADMIN si proviene de registro Web Público. */
  @ApiProperty({
    description: 'The access level of the user',
    enum: ACCESS_LEVEL,
    required: false,
  })
  @IsOptional()
  @IsEnum(ACCESS_LEVEL)
  userAccess?: ACCESS_LEVEL;

  /** @property {string} userFullName - Nombre completo opcional, utilizado para personalización de Correos. */
  @ApiProperty({
    description: 'The full name of the user',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El nombre completo debe ser una cadena de texto' })
  @MinLength(4, {
    message: 'El nombre completo debe tener al menos $constraint1 caracteres',
  })
  @MaxLength(50, {
    message: 'El nombre completo no puede superar los $constraint1 caracteres',
  })
  userFullName?: string;

  /** @property {string} userEmail - Dirección destino para 2FA y Verificación. */
  @ApiProperty({
    description: 'The unique email address of the user',
    example: 'info@knx.bolivia.bo',
  })
  @IsNotEmpty()
  @IsString()
  @IsEmail()
  userEmail: string;

  @ApiProperty({
    description: 'Optional token for internal use',
    required: false,
  })
  @IsOptional()
  @IsString()
  userToken?: string;

  @ApiProperty({
    description: 'Whether the user is currently logged in',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  userLogin?: boolean;

  @ApiProperty({
    description: 'The last time the user was seen online',
    required: false,
  })
  @IsOptional()
  @IsDate()
  userLastseen?: Date;

  @ApiProperty({
    description: 'The status of the user account (active/inactive)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  userStatus?: boolean;

  @ApiProperty({ description: 'Password salt for hashing', required: false })
  @IsOptional()
  @IsString()
  salt?: string;

  @ApiProperty({
    description: 'Whether the user is a superuser (Root access)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isSuperuser?: boolean;

  @ApiProperty({
    description: 'The user timezone (IANA format)',
    example: 'America/Guayaquil',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  timezone?: string;

  @ApiProperty({
    description: 'The origin of the user registration',
    example: 'WEB',
    required: false,
  })
  @IsOptional()
  @IsString()
  userOrigin?: string;

  @ApiProperty({
    description: 'Whether the user email is verified',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({
    description: 'Whether 2FA is enabled for this user',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isTwoStepAuthEnabled?: boolean;

  @ApiProperty({ description: 'The code generated for 2FA', required: false })
  @IsOptional()
  @IsString()
  twoStepCode?: string;

  @ApiProperty({
    description: 'The expiration date of the 2FA code',
    required: false,
  })
  @IsOptional()
  @IsDate()
  twoStepExpires?: Date;
}

/**
 * @description DTO especializado para el registro público.
 * Filtra solo los campos necesarios para que la documentación de Swagger sea limpia.
 */
export class RegisterUserDto extends PickType(UserDto, [
  'username',
  'password',
  'userEmail',
]) {}
