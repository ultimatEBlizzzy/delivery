import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, StoreStaffRole } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { UploadedFile as UploadedFileType } from '../storage/storage.service';
import { imageUpload } from './admin-stores.controller';
import { CurrentStore, StoreContext, StoreRoles } from './store-context';
import { StoreContextGuard } from './store-context.guard';
import { StoreStaffService } from './store-staff.service';
import { AddStaffDto, StaffQueryDto, UpdateOwnStoreDto, UpdateStaffDto } from './stores.dto';
import { StoresService } from './stores.service';

const fileBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
};

/** "My store" endpoints. Always scoped to the caller's own store by StoreContextGuard. */
@ApiTags('Store portal · Profile & staff')
@Auth(Role.STORE)
@UseGuards(StoreContextGuard)
@Controller('store')
export class StorePortalController {
  constructor(
    private readonly stores: StoresService,
    private readonly staff: StoreStaffService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'My store profile, plus my role in it' })
  async me(@CurrentStore() ctx: StoreContext) {
    return { ...(await this.stores.getAdmin(ctx.storeId)), myRole: ctx.staffRole };
  }

  @Patch('me')
  @StoreRoles(StoreStaffRole.OWNER, StoreStaffRole.MANAGER)
  @ApiOperation({
    summary: 'Update description, contact details, opening hours, pause/resume orders',
  })
  update(@CurrentStore() ctx: StoreContext, @Body() dto: UpdateOwnStoreDto) {
    return this.stores.updateOwn(ctx.storeId, dto);
  }

  @Post('me/logo')
  @StoreRoles(StoreStaffRole.OWNER, StoreStaffRole.MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  logo(@CurrentStore() ctx: StoreContext, @UploadedFile() file: UploadedFileType) {
    return this.stores.setImage(ctx.storeId, 'logo', file);
  }

  @Post('me/banner')
  @StoreRoles(StoreStaffRole.OWNER, StoreStaffRole.MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  banner(@CurrentStore() ctx: StoreContext, @UploadedFile() file: UploadedFileType) {
    return this.stores.setImage(ctx.storeId, 'banner', file);
  }

  // ---- staff (owner only) ---------------------------------------------------------------------
  @Get('staff')
  @StoreRoles(StoreStaffRole.OWNER, StoreStaffRole.MANAGER)
  listStaff(@CurrentStore() ctx: StoreContext, @Query() query: StaffQueryDto) {
    return this.staff.list(query, { storeId: ctx.storeId });
  }

  @Post('staff')
  @StoreRoles(StoreStaffRole.OWNER)
  addStaff(@CurrentStore() ctx: StoreContext, @Body() dto: AddStaffDto) {
    return this.staff.add(ctx.storeId, dto);
  }

  @Patch('staff/:staffId')
  @StoreRoles(StoreStaffRole.OWNER)
  updateStaff(
    @CurrentStore() ctx: StoreContext,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(ctx.storeId, staffId, dto);
  }

  @Delete('staff/:staffId')
  @StoreRoles(StoreStaffRole.OWNER)
  @HttpCode(204)
  async removeStaff(
    @CurrentStore() ctx: StoreContext,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<void> {
    await this.staff.remove(ctx.storeId, staffId);
  }
}
