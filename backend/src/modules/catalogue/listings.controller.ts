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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AdjustStockDto, MovementQueryDto } from '../inventory/dto/inventory.dto';
import { InventoryService } from '../inventory/inventory.service';
import { UploadedFile as UploadedFileType } from '../storage/storage.service';
import { imageUpload } from '../stores/admin-stores.controller';
import { CurrentStore, StoreContext, StoreRoles } from '../stores/store-context';
import { StoreContextGuard } from '../stores/store-context.guard';
import {
  AdminCreateListingDto,
  CatalogueSearchQueryDto,
  CreateListingDto,
  CreateProductDto,
  ListingQueryDto,
  UpdateListingDto,
  UpdateProductDto,
} from './catalogue.dto';
import { ListingsService } from './listings.service';
import { ProductImagesService } from './product-images.service';
import { ProductsService } from './products.service';

const fileBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } },
  },
};
const PRICE_ROLES = [StoreStaffRole.OWNER, StoreStaffRole.MANAGER];

@ApiTags('Admin · Store listings & inventory')
@Auth(Role.ADMIN)
@Controller('admin')
export class AdminListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly inventory: InventoryService,
  ) {}

  @Get('listings')
  @ApiOperation({
    summary:
      'Store offers across all stores (price, sale price, stock) – filter by store, category, stock level',
  })
  list(@Query() query: ListingQueryDto) {
    return this.listings.list(query, {});
  }

  @Post('listings')
  @ApiOperation({ summary: 'Create a store offer for a catalogue product' })
  create(@Body() dto: AdminCreateListingDto) {
    const { storeId, ...rest } = dto;
    return this.listings.create(storeId, rest);
  }

  @Get('listings/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.get(id);
  }

  @Patch('listings/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.listings.update(id, dto);
  }

  @Delete('listings/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.listings.remove(id);
  }

  @Post('listings/:id/stock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add, remove or set stock (always recorded in the inventory ledger)' })
  async adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.inventory.adjustFromRequest(id, dto, user.id);
    return this.listings.get(id);
  }

  @Get('inventory/movements')
  @ApiOperation({ summary: 'Inventory ledger across stores' })
  movements(@Query() query: MovementQueryDto) {
    return this.inventory.listMovements(query, {});
  }
}

/** The store portal's catalogue, listings and inventory – scoped to the caller's own store. */
@ApiTags('Store portal · Products & inventory')
@Auth(Role.STORE)
@UseGuards(StoreContextGuard)
@Controller('store')
export class StoreListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly products: ProductsService,
    private readonly images: ProductImagesService,
    private readonly inventory: InventoryService,
  ) {}

  // ---- my listings ----------------------------------------------------------------------------
  @Get('listings')
  list(@CurrentStore() ctx: StoreContext, @Query() query: ListingQueryDto) {
    return this.listings.list(query, { storeId: ctx.storeId });
  }

  @Post('listings')
  @StoreRoles(...PRICE_ROLES)
  @ApiOperation({ summary: 'List a catalogue product in my store with my own price and stock' })
  create(@CurrentStore() ctx: StoreContext, @Body() dto: CreateListingDto) {
    return this.listings.create(ctx.storeId, dto);
  }

  @Get('listings/:id')
  get(@CurrentStore() ctx: StoreContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.get(id, ctx.storeId);
  }

  @Patch('listings/:id')
  @StoreRoles(...PRICE_ROLES)
  update(
    @CurrentStore() ctx: StoreContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(id, dto, ctx.storeId);
  }

  @Delete('listings/:id')
  @StoreRoles(...PRICE_ROLES)
  @HttpCode(204)
  async remove(
    @CurrentStore() ctx: StoreContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.listings.remove(id, ctx.storeId);
  }

  // ---- inventory (all staff may adjust stock) -------------------------------------------------
  @Post('listings/:id/stock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add, remove or set stock (recorded in the inventory ledger)' })
  async adjustStock(
    @CurrentStore() ctx: StoreContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.listings.get(id, ctx.storeId); // 404 unless the listing belongs to MY store
    await this.inventory.adjustFromRequest(id, dto, user.id);
    return this.listings.get(id, ctx.storeId);
  }

  @Get('inventory/movements')
  movements(@CurrentStore() ctx: StoreContext, @Query() query: MovementQueryDto) {
    return this.inventory.listMovements(query, { storeId: ctx.storeId });
  }

  // ---- global catalogue ----------------------------------------------------------------------
  @Get('catalogue/products')
  @ApiOperation({ summary: 'Search the global catalogue to find a product to list' })
  catalogue(@CurrentStore() ctx: StoreContext, @Query() query: CatalogueSearchQueryDto) {
    return this.products.searchForStore(ctx.storeId, query);
  }

  @Post('catalogue/products')
  @StoreRoles(...PRICE_ROLES)
  @ApiOperation({
    summary: 'Add a product that is missing from the catalogue (search first to avoid duplicates)',
  })
  createProduct(@CurrentStore() ctx: StoreContext, @Body() dto: CreateProductDto) {
    return this.products.create(dto, { createdByStoreId: ctx.storeId });
  }

  @Patch('catalogue/products/:productId')
  @StoreRoles(...PRICE_ROLES)
  @ApiOperation({
    summary: 'Edit a product your store created (shared products are admin-managed)',
  })
  updateProduct(
    @CurrentStore() ctx: StoreContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(productId, dto, { storeId: ctx.storeId });
  }

  @Post('catalogue/products/:productId/images')
  @StoreRoles(...PRICE_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload())
  async addProductImage(
    @CurrentStore() ctx: StoreContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: UploadedFileType,
    @Body('alt') alt?: string,
  ) {
    await this.products.assertStoreOwnsProduct(ctx.storeId, productId);
    return this.images.add(productId, file, alt);
  }

  @Delete('catalogue/products/:productId/images/:imageId')
  @StoreRoles(...PRICE_ROLES)
  @HttpCode(204)
  async removeProductImage(
    @CurrentStore() ctx: StoreContext,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    await this.products.assertStoreOwnsProduct(ctx.storeId, productId);
    await this.images.remove(productId, imageId);
  }
}
