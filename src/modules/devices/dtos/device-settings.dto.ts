import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * @description Sub-DTO para la configuración WiFi del ESP32.
 */
export class WifiSettingsDto {
  @ApiProperty({ example: 'IOTHost_AP' })
  @IsString()
  wifi_ssid: string;

  @ApiProperty({ example: '********' })
  @IsString()
  wifi_password: string;

  @ApiProperty({ example: 'ESP32_AP' })
  @IsString()
  ap_ssid: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  ap_password: string;

  @ApiProperty({ example: '192.168.4.1' })
  @IsString()
  ap_ip: string;
}

/**
 * @description Sub-DTO para la configuración MQTT del ESP32.
 */
export class MqttSettingsDto {
  @ApiProperty({ example: 'emqx.iothost.org' })
  @IsString()
  mqtt_server: string;

  @ApiProperty({ example: 1883 })
  @IsNumber()
  mqtt_port: number;

  @ApiProperty({ example: 'emqx_user' })
  @IsString()
  mqtt_user: string;

  @ApiProperty({ example: '********' })
  @IsString()
  mqtt_password: string;

  @ApiProperty({ example: '/root/esp32/ESP32DC15B80C/command' })
  @IsString()
  mqtt_commandTopic: string;

  @ApiProperty({ example: '/root/esp32/ESP32DC15B80C/state' })
  @IsString()
  mqtt_stateTopic: string;
}

/**
 * @description Sub-DTO para la configuración de tiempo y NTP.
 */
export class TimeSettingsDto {
  @ApiProperty({ example: 'America/La_Paz' })
  @IsString()
  timezone: string;

  @ApiProperty({ example: 'pool.ntp.org' })
  @IsString()
  ntp_server: string;

  @ApiProperty({ example: 3600 })
  @IsNumber()
  gmt_offset: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  daylight_offset: boolean;
}

/**
 * @description DTO principal que emula el settings.json completo del dispositivo.
 */
export class DeviceSettingsDataDto {
  @ApiProperty({ type: WifiSettingsDto })
  @IsOptional()
  wifi?: WifiSettingsDto;

  @ApiProperty({ type: MqttSettingsDto })
  @IsOptional()
  mqtt?: MqttSettingsDto;

  @ApiProperty({ type: TimeSettingsDto })
  @IsOptional()
  time?: TimeSettingsDto;
}
