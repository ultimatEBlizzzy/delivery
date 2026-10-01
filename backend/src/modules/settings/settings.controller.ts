import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  @ApiOperation({ summary: 'Non-sensitive platform settings (name, support contacts)' })
  getPublic() {
    return this.settings.getPublic();
  }

  @Auth(Role.ADMIN)
  @Get('admin/settings')
  @ApiOperation({ summary: 'All platform settings with their current values and metadata' })
  getAll() {
    return this.settings.getAll();
  }

  @Auth(Role.ADMIN)
  @Patch('admin/settings')
  @ApiOperation({
    summary: 'Update one or more platform settings (validated against the settings schema)',
  })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.updateMany(dto.settings);
  }
}
