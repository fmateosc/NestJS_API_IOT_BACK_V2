import { forwardRef, Module } from '@nestjs/common';
import { DevicesService } from './services/devices.service.js';
import { DevicesController } from './controllers/devices.controller.js';
import { UsersModule } from '../users/users.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceSettingsEntity } from './entities/device-settings.entity.js';
import { DevicesEntity } from './entities/devices.entity.js';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    //forwardRef(() => MqttProviderModule),
    //forwardRef(() => WebsocketsProviderModule),
    TypeOrmModule.forFeature([DevicesEntity, DeviceSettingsEntity]),
  ],
  providers: [DevicesService, DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService, DevicesService],
})
export class DevicesModule {}
