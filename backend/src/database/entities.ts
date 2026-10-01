import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { Category } from '../modules/catalogue/entities/category.entity';
import { ProductImage } from '../modules/catalogue/entities/product-image.entity';
import { Product } from '../modules/catalogue/entities/product.entity';
import { StoreProduct } from '../modules/catalogue/entities/store-product.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { Customer } from '../modules/customers/entities/customer.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { PlatformSetting } from '../modules/settings/entities/platform-setting.entity';
import { HardwareStore } from '../modules/stores/entities/hardware-store.entity';
import { StoreStaff } from '../modules/stores/entities/store-staff.entity';
import { RoleEntity } from '../modules/users/entities/role.entity';
import { User } from '../modules/users/entities/user.entity';

/**
 * Every entity in the application. Listed explicitly (no globbing) so the same list works for
 * ts-node, compiled `dist`, Jest and the TypeORM CLI.
 */
export const ALL_ENTITIES = [
  // identity & platform
  RoleEntity,
  User,
  Customer,
  RefreshToken,
  AuditLog,
  PlatformSetting,
  // stores & catalogue
  HardwareStore,
  StoreStaff,
  Category,
  Product,
  ProductImage,
  StoreProduct,
  InventoryMovement,
];
