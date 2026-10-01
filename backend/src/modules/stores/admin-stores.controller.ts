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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, Role } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { UploadedFile as UploadedFileType } from '../storage/storage.service';
import { StoreStaffService } from './store-staff.service';
import {
  AddStaffDto,
  AdminStoreQueryDto,
  CreateStoreDto,
  SetStoreActiveDto,
  SetStoreStatusDto,
  StaffQueryDto,
  UpdateStaffDto,
  UpdateStoreDto,
} from './stores.dto';
import { StoresService } from './stores.service';

export const imageUpload = () =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  });

const fileBody = {
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
};

@ApiTags('Admin · Stores')
@Auth(Role.ADMIN)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly staff: StoreStaffService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List stores (server-side search, status filter, pagination)' })
  list(@Query() query: AdminStoreQueryDto) {
    return this.stores.listAdmin(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a store, optionally with its owner account' })
  create(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stores.getAdmin(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.update(id, dto);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve, reject (reason required) or reset a store to pending' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStoreStatusDto) {
    return this.stores.setStatus(id, dto.status, dto.reason);
  }

  @Post(':id/active')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspend or reactivate a store' })
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStoreActiveDto) {
    return this.stores.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.stores.remove(id);
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  logo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedFileType) {
    return this.stores.setImage(id, 'logo', file);
  }

  @Post(':id/banner')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  banner(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedFileType) {
    return this.stores.setImage(id, 'banner', file);
  }
}

@ApiTags('Admin · Store staff')
@Auth(Role.ADMIN)
@Controller('admin')
export class AdminStaffController {
  constructor(private readonly staff: StoreStaffService) {}

  @Get('store-staff')
  @ApiOperation({ summary: 'Staff across all stores (filter by store or search by name/email)' })
  list(@Query() query: StaffQueryDto) {
    return this.staff.list(query, {});
  }

  @Post('stores/:storeId/staff')
  @ApiOperation({ summary: 'Add (or link) a staff member to a store' })
  add(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: AddStaffDto) {
    return this.staff.add(storeId, dto);
  }

  @Patch('stores/:storeId/staff/:staffId')
  update(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(storeId, staffId, dto);
  }

  @Delete('stores/:storeId/staff/:staffId')
  @HttpCode(204)
  async remove(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<void> {
    await this.staff.remove(storeId, staffId);
  }
}
