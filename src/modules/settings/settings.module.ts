import { Module } from '@nestjs/common';
import { SettingsService } from './services/settings.service.js';
import { SettingsController } from './controllers/settings.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { GeneralSettingsEntity } from './entities/settings.entity.js';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([GeneralSettingsEntity])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService, TypeOrmModule],
})
export class SettingsModule {}
