// src/modules/providers/mqtt-provider.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { MqttService } from './mqtt/mqtt.service1.js';

@Module({
  imports: [forwardRef(() => SettingsModule)], // MqttService inyecta SettingsService
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttProviderModule {}
