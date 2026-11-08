// src/common/dtos/pagination.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

/**
 * @description Data Transfer Object base para queries paginadas (GET Listados).
 * Abstrae y tipifica los parámetros estándar de URL `?limit=&offset=`
 * sumando herramientas custom como filtros por UUID o búsquedas full-text.
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Number of results per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit?: number;

  // new update front
  @ApiProperty({
    description: 'Number of upcoming executions to calculate per task',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limitPerTask?: number;

  @ApiProperty({
    description: 'Number of results to skip',
    example: 0,
    required: false,
  })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Filter by entity type (e.g. ESP32 for devices)',
    example: 'ESP32',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: any;

  @ApiProperty({
    description: 'Search term for filtering results',
    example: 'emqx',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
