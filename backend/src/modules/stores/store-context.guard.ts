import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreStaffRole } from '@hardware-delivery/shared';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { StoreStaff } from './entities/store-staff.entity';
import { STORE_ROLES_KEY } from './store-context';

const ROLE_PRIORITY: Record<StoreStaffRole, number> = {
  [StoreStaffRole.OWNER]: 0,
  [StoreStaffRole.MANAGER]: 1,
  [StoreStaffRole.STAFF]: 2,
};

/**
 * Tenant isolation for the store portal. Every `/store/*` request is scoped to ONE store the caller
 * is an active member of. The store id is never taken from the URL or body: handlers receive it from
 * `@CurrentStore()`, so one store can never read or modify another store's data.
 * Users that belong to several stores pick one with the `X-Store-Id` header.
 */
@Injectable()
export class StoreContextGuard implements CanActivate {
  constructor(
    @InjectRepository(StoreStaff) private readonly staff: Repository<StoreStaff>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Sign in to continue');

    const memberships = (
      await this.staff.find({
        where: { userId: user.id, isActive: true },
        relations: { store: true },
      })
    )
      .filter((m) => m.store && !m.store.deletedAt)
      .sort(
        (a, b) =>
          ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role] ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );

    const requested = (req.header('x-store-id') as string | undefined)?.trim();
    const membership = requested
      ? memberships.find((m) => m.storeId === requested)
      : memberships[0];
    if (!membership) {
      throw new ForbiddenException(
        requested
          ? 'You are not a member of that store'
          : 'Your account is not linked to a store. Ask an administrator to add you.',
      );
    }

    const allowed = this.reflector.getAllAndOverride<StoreStaffRole[] | undefined>(
      STORE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed?.length && !allowed.includes(membership.role)) {
      throw new ForbiddenException(`This action requires the store role: ${allowed.join(' or ')}`);
    }

    req.storeContext = {
      storeId: membership.storeId,
      staffRole: membership.role,
      store: membership.store,
    };
    return true;
  }
}
