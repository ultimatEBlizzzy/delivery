import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { HardwareStore } from '../stores/entities/hardware-store.entity';
import { StoreStaff } from '../stores/entities/store-staff.entity';
import { StoreContextGuard } from '../stores/store-context.guard';
import { CatalogueBrowseService } from './catalogue-browse.service';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController, CategoriesController } from './categories.controller';
import { Category } from './entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { StoreProduct } from './entities/store-product.entity';
import { AdminListingsController, StoreListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ProductImagesService } from './product-images.service';
import { AdminProductsController, ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Product,
      ProductImage,
      StoreProduct,
      HardwareStore,
      StoreStaff,
    ]),
    InventoryModule,
  ],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    ProductsController,
    AdminProductsController,
    AdminListingsController,
    StoreListingsController,
  ],
  providers: [
    CategoriesService,
    ProductsService,
    ProductImagesService,
    ListingsService,
    CatalogueBrowseService,
    StoreContextGuard,
  ],
  exports: [
    CategoriesService,
    ProductsService,
    ListingsService,
    CatalogueBrowseService,
    TypeOrmModule,
  ],
})
export class CatalogueModule {}
