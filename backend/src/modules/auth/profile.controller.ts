import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@Auth()
@Controller('users/me')
export class ProfileController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My profile' })
  get(@CurrentUser() user: AuthUser) {
    return this.auth.getUserDto(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my name and phone number' })
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    await this.users.updateProfile(user.id, dto);
    return this.auth.getUserDto(user.id);
  }
}
