import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { StoreStaffRole } from '@hardware-delivery/shared';
import { HardwareStore } from './entities/hardware-store.entity';

export interface StoreContext {
  storeId: string;
  staffRole: StoreStaffRole;
  store: HardwareStore;
}

export const STORE_ROLES_KEY = 'storeRoles';

/** Restrict a store-portal route to certain staff roles, e.g. @StoreRoles(OWNER, MANAGER). */
export const StoreRoles = (...roles: StoreStaffRole[]) => SetMetadata(STORE_ROLES_KEY, roles);

/** The store the signed-in staff member is acting on (set by StoreContextGuard). */
export const CurrentStore = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StoreContext => {
    return ctx.switchToHttp().getRequest().storeContext as StoreContext;
  },
);
