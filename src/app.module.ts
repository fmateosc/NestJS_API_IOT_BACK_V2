// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import typeorm from './config/typeorm.js';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const config = configService.get<TypeOrmModuleOptions>('typeorm');

        if (!config) {
          throw new Error('Missing TypeORM configuration');
        }
        return config;
      },
    }),
  ],
  controllers: [],
  providers: [{
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },],
})
export class AppModule {}
