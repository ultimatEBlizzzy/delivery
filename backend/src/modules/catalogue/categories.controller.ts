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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UploadedFile as UploadedFileType } from '../storage/storage.service';
import { imageUpload } from '../stores/admin-stores.controller';
import { CreateCategoryDto, UpdateCategoryDto } from './catalogue.dto';
import { toCategoryDto, toCategoryRef } from './catalogue.mapper';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active category tree with the number of purchasable listings in each' })
  tree() {
    return this.categories.tree({});
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'One category with its breadcrumb path' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const category = await this.categories.getOrFail(id);
    const path = await this.categories.ancestors(id);
    return { ...toCategoryDto(category), path: path.map(toCategoryRef) };
  }
}

@ApiTags('Admin · Categories')
@Auth(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Full category tree including inactive categories' })
  tree() {
    return this.categories.tree({ includeInactive: true });
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categories.remove(id);
  }

  @Post(':id/image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(imageUpload())
  image(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedFileType) {
    return this.categories.setImage(id, file);
  }
}
