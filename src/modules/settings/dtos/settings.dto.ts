// src/modules/settings/dtos/settings.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class GeneralSettinsDto {
  @ApiProperty({
    description: 'The global system timezone (IANA format)',
    example: 'America/Guayaquil',
  })
  @IsString()
  @Length(1, 100)
  timezone: string;

  @ApiProperty({
    description: 'EMQX API Key for bridge management',
    example: 'f3a2...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  emqxApiKey?: string;

  @ApiProperty({
    description: 'EMQX API Secret Key',
    example: 'z1x2...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  emqxApiSecretKey?: string;

  @ApiProperty({
    description: 'EMQX HTTP API Host',
    example: 'iot.example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  emqxAppHost?: string;

  @ApiProperty({
    description: 'EMQX HTTP API Port',
    example: 18083,
    required: false,
  })
  @IsOptional()
  @IsInt()
  emqxAppPort?: number;

  @ApiProperty({
    description: 'MQTT Broker Username for the API connection',
    example: 'api_user',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  mqttApiUser?: string;

  @ApiProperty({
    description: 'MQTT Broker Password for the API connection',
    example: 'P@ssw0rd123*',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  @Matches(
    /(?=(.*[0-9]))(?=.*[\!@#$%^&*()\\[\]{}\-_+=|:;"'<>,./?])(?=.*[a-z])(?=(.*[A-Z]))(?=(.*)).{8,20}/,
    {
      message:
        'The password must contain at least one lowercase letter, one uppercase letter, one number, one special character, and be between 8 and 20 characters long',
    },
  )
  mqttApiPassword?: string;

  @ApiProperty({
    description: 'MQTT Broker Port',
    example: 1883,
    required: false,
  })
  @IsOptional()
  @IsInt()
  mqttApiPort?: number;

  @ApiProperty({
    description: 'Core API Host URL',
    example: 'api.iothost.org',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  apiCoreHost?: string;

  @ApiProperty({ description: 'Core API Port', example: 3000, required: false })
  @IsOptional()
  @IsInt()
  apiCorePort?: number;

  @ApiProperty({
    description: 'Telegram Bot Token for notifications',
    example: '123456:ABC...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  telegramBotToken?: string;

  @ApiProperty({
    description: 'SMTP Host for emails',
    example: 'smtp.gmail.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 150)
  smtpHost?: string;

  @ApiProperty({
    description: 'SMTP Username',
    example: 'alerts@iothost.org',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 150)
  smtpUser?: string;

  @ApiProperty({
    description: 'SMTP Password',
    example: 'secret_smtp_pass',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 150)
  smtpPassword?: string;

  @ApiProperty({ description: 'SMTP Port', example: 587, required: false })
  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @ApiProperty({
    description: 'Whether to use TLS/SSL for SMTP',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;
}
