import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AccessLevelGuard } from '../../auth/guard/access-level.guard.js';
import { AuthGuard } from '../../auth/guard/auth.guard.js';
import { SettingsService } from '../services/settings.service.js';
import { Access } from '../../auth/decorators/access.decorator.js';
import { GeneralSettinsDto } from '../dtos/settings.dto.js';

@Controller('settings')
@UseGuards(AuthGuard, AccessLevelGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // add new Settings
  @Access('ROOT')
  @Post('register')
  public async createNewSettings(@Body() newSettingsData: GeneralSettinsDto) {
    return await this.settingsService.createNewSettings(newSettingsData);
  }
}
