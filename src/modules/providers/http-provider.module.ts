import { Global, Module } from '@nestjs/common';
import { EmqxApiService } from './http/emqx-api.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { HttpModule } from '@nestjs/axios';
import { MqttProviderModule } from './mqtt-provider.module.js';


@Global()
@Module({
  imports: [
    HttpModule,
    SettingsModule,
    MqttProviderModule,
    //MqttProviderModule,
    //WebsocketsProviderModule,
  ],
  providers: [EmqxApiService],
  exports: [
    HttpModule,
    EmqxApiService,
    MqttProviderModule,
    //WebsocketsProviderModule,
  ],
})
export class HttpProviderModule {}
