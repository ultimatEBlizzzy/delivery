import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { UsersModule } from '../users/users.module';
import { HardwareStore } from './entities/hardware-store.entity';
import { StoreStaff } from './entities/store-staff.entity';
import { AdminStaffController, AdminStoresController } from './admin-stores.controller';
import { StoreContextGuard } from './store-context.guard';
import { StorePortalController } from './store-portal.controller';
import { StoreStaffService } from './store-staff.service';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HardwareStore, StoreStaff]),
    UsersModule,
    AuthModule,
    CatalogueModule,
  ],
  controllers: [
    StoresController,
    AdminStoresController,
    AdminStaffController,
    StorePortalController,
  ],
  providers: [StoresService, StoreStaffService, StoreContextGuard],
  exports: [StoresService, StoreStaffService, StoreContextGuard, TypeOrmModule],
})
export class StoresModule {}
