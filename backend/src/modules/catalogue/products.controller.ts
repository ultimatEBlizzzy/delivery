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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UploadedFile as UploadedFileType } from '../storage/storage.service';
import { imageUpload } from '../stores/admin-stores.controller';
import { CatalogueBrowseService } from './catalogue-browse.service';
import {
  AdminProductQueryDto,
  CreateProductDto,
  ProductDetailQueryDto,
  PublicListingQueryDto,
  UpdateProductDto,
} from './catalogue.dto';
import { ProductImagesService } from './product-images.service';
import { ProductsService } from './products.service';

const fileBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } },
  },
};

@ApiTags('Products (public)')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly browse: CatalogueBrowseService) {}

  @Get()
  @ApiOperation({
    summary: 'Search store offers',
    description:
      "One result per store offer: the same product from two stores appears twice, each with that store's own price and stock.",
  })
  search(@Query() query: PublicListingQueryDto) {
    return this.browse.searchListings(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({
    summary:
      'Product details with every store offer (cheapest first, or nearest first with lat/lng)',
  })
  detail(@Param('idOrSlug') idOrSlug: string, @Query() query: ProductDetailQueryDto) {
    return this.browse.productDetail(idOrSlug, query);
  }
}

@ApiTags('Admin · Products')
@Auth(Role.ADMIN)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly images: ProductImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Global catalogue (server-side search, category filter, pagination)' })
  list(@Query() query: AdminProductQueryDto) {
    return this.products.listAdmin(query);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.getAdmin(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.products.remove(id);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  async addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileType,
    @Body('alt') alt?: string,
  ) {
    await this.products.assertExists(id);
    return this.images.add(id, file, alt);
  }

  @Post(':id/images/:imageId/primary')
  @HttpCode(200)
  setPrimary(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.setPrimary(id, imageId);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  async removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    await this.images.remove(id, imageId);
  }
}
