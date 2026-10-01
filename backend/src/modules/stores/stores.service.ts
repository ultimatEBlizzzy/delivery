import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  DEFAULT_OPERATING_HOURS,
  Paginated,
  Role,
  StoreAdminDto,
  StoreDetailDto,
  StoreStaffRole,
  StoreStatus,
  StoreSummaryDto,
} from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { SQL_POINT, toPoint } from '../../common/utils/geo';
import { badRequestFromProblems } from '../../common/utils/problems';
import { likeEscape, searchTokens } from '../../common/utils/query';
import { slugify } from '../../common/utils/slug';
import { generateTemporaryPassword } from '../../common/utils/password';
import { RequestContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { GeoService } from '../geo/geo.service';
import { CategoriesService } from '../catalogue/categories.service';
import {
  VISIBLE_LISTING_SQL,
  VISIBLE_PRODUCT_SQL,
  VISIBLE_STORE_SQL,
} from '../catalogue/visibility';
import { StorageService, UploadedFile } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { HardwareStore } from './entities/hardware-store.entity';
import { StoreStaff } from './entities/store-staff.entity';
import {
  AdminStoreQueryDto,
  CreateStoreDto,
  PublicStoreQueryDto,
  StoreDetailQueryDto,
  UpdateOwnStoreDto,
  UpdateStoreDto,
} from './stores.dto';
import { toStoreAdmin, toStoreDetail, toStoreSummary } from './store.mapper';

export interface CreatedStore {
  store: StoreAdminDto;
  /** Present only when a temporary password was generated for a NEW owner account (shown once). */
  ownerCredentials?: { email: string; temporaryPassword: string };
}

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(HardwareStore) private readonly stores: Repository<HardwareStore>,
    @InjectRepository(StoreStaff) private readonly staff: Repository<StoreStaff>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly categories: CategoriesService,
    private readonly geo: GeoService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // -------------------------------------------------------------------------------------------
  // Public discovery
  // -------------------------------------------------------------------------------------------

  /** Approved, active stores, optionally ranked by distance from the customer (PostGIS). */
  async listPublic(q: PublicStoreQueryDto): Promise<Paginated<StoreSummaryDto>> {
    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    const point = { lat: q.lat, lng: q.lng };
    const qb = this.stores.createQueryBuilder('s').where(VISIBLE_STORE_SQL);

    searchTokens(q.search).forEach((token, i) => {
      qb.andWhere(`(s.name ILIKE :t${i} OR s.city ILIKE :t${i} OR s.suburb ILIKE :t${i})`, {
        [`t${i}`]: `%${likeEscape(token)}%`,
      });
    });
    if (hasPoint && q.radiusKm) {
      const near = await this.geo.idsWithinRadius({
        table: 'hardware_stores',
        lat: q.lat!,
        lng: q.lng!,
        radiusKm: q.radiusKm,
        where: VISIBLE_STORE_SQL,
      });
      if (near.size === 0) return toPaginated([], 0, q.page, q.limit);
      qb.andWhere('s.id = ANY(:nearIds)', { nearIds: [...near.keys()] });
    }
    if (q.categoryId) {
      const cats = await this.categories.descendantIds(q.categoryId);
      qb.andWhere(
        `EXISTS (SELECT 1 FROM store_products sp JOIN products p ON p.id = sp.product_id
                  WHERE sp.store_id = s.id AND ${VISIBLE_LISTING_SQL} AND ${VISIBLE_PRODUCT_SQL}
                    AND p.category_id IN (:...cats))`,
        { cats },
      );
    }

    const total = await qb.clone().getCount();
    const sort = q.sort ?? (hasPoint ? 'distance' : 'name');
    if (hasPoint)
      qb.addSelect(`ST_Distance(s.location, ${SQL_POINT})`, 'distance_m').setParameters(point);
    if (sort === 'distance' && hasPoint) qb.orderBy('distance_m', 'ASC');
    else if (sort === 'rating')
      qb.orderBy('s.rating_average', 'DESC').addOrderBy('s.rating_count', 'DESC');
    else qb.orderBy('s.name', 'ASC');
    qb.addOrderBy('s.id', 'ASC').offset(q.offset).limit(q.limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const data = entities.map((store, i) => {
      const meters = hasPoint ? Number((raw[i] as { distance_m?: number }).distance_m) : null;
      return toStoreSummary(store, meters === null || Number.isNaN(meters) ? null : meters / 1000);
    });
    return toPaginated(data, total, q.page, q.limit);
  }

  /** A single visible store by id or slug, with the categories it sells in. */
  async getPublic(idOrSlug: string, q: StoreDetailQueryDto = {}): Promise<StoreDetailDto> {
    const store = await this.stores.findOne({
      where: isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    });
    if (!store || store.status !== StoreStatus.APPROVED || !store.isActive)
      throw new NotFoundException('Store not found');

    const categories = (await this.dataSource.query(
      `SELECT c.id, c.name, c.slug, COUNT(*)::int AS "listingCount"
         FROM store_products sp
         JOIN products p ON p.id = sp.product_id AND ${VISIBLE_PRODUCT_SQL}
         JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
        WHERE sp.store_id = $1 AND ${VISIBLE_LISTING_SQL}
        GROUP BY c.id, c.name, c.slug
        ORDER BY c.name`,
      [store.id],
    )) as Array<{ id: string; name: string; slug: string; listingCount: number }>;

    let distanceKm: number | null | undefined;
    if (q.lat !== undefined && q.lng !== undefined) {
      const [row] = (await this.dataSource.query(
        `SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) / 1000 AS km FROM hardware_stores WHERE id = $1`,
        [store.id, q.lng, q.lat],
      )) as Array<{ km: number }>;
      distanceKm = row ? Number(row.km) : null;
    }
    return toStoreDetail(store, categories, distanceKm);
  }

  // -------------------------------------------------------------------------------------------
  // Administration
  // -------------------------------------------------------------------------------------------

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'store';
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? base : `${base}-${i}`;
      if (!(await this.stores.exists({ where: { slug: candidate }, withDeleted: true })))
        return candidate;
    }
  }

  private async counts(
    ids: string[],
  ): Promise<Map<string, { listingCount: number; staffCount: number }>> {
    const map = new Map(ids.map((id) => [id, { listingCount: 0, staffCount: 0 }]));
    if (!ids.length) return map;
    const listings = (await this.dataSource.query(
      `SELECT store_id AS id, COUNT(*)::int AS n FROM store_products WHERE deleted_at IS NULL AND store_id = ANY($1) GROUP BY store_id`,
      [ids],
    )) as Array<{ id: string; n: number }>;
    const staff = (await this.dataSource.query(
      `SELECT store_id AS id, COUNT(*)::int AS n FROM store_staff WHERE store_id = ANY($1) GROUP BY store_id`,
      [ids],
    )) as Array<{ id: string; n: number }>;
    listings.forEach((r) => (map.get(r.id)!.listingCount = Number(r.n)));
    staff.forEach((r) => (map.get(r.id)!.staffCount = Number(r.n)));
    return map;
  }

  private async load(id: string): Promise<HardwareStore> {
    const store = await this.stores.findOne({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async getAdmin(id: string): Promise<StoreAdminDto> {
    const store = await this.load(id);
    return toStoreAdmin(store, (await this.counts([id])).get(id)!);
  }

  async listAdmin(q: AdminStoreQueryDto): Promise<Paginated<StoreAdminDto>> {
    const qb = this.stores.createQueryBuilder('s');
    searchTokens(q.search).forEach((token, i) => {
      qb.andWhere(
        `(s.name ILIKE :t${i} OR s.city ILIKE :t${i} OR s.email ILIKE :t${i} OR s.suburb ILIKE :t${i})`,
        {
          [`t${i}`]: `%${likeEscape(token)}%`,
        },
      );
    });
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.isActive !== undefined) qb.andWhere('s.is_active = :active', { active: q.isActive });
    if (q.province) qb.andWhere('s.province = :province', { province: q.province });
    qb.orderBy('s.createdAt', 'DESC').addOrderBy('s.id', 'ASC').skip(q.offset).take(q.limit);
    const [rows, total] = await qb.getManyAndCount();
    const counts = await this.counts(rows.map((r) => r.id));
    return toPaginated(
      rows.map((r) => toStoreAdmin(r, counts.get(r.id)!)),
      total,
      q.page,
      q.limit,
    );
  }

  async create(dto: CreateStoreDto): Promise<CreatedStore> {
    const status = dto.status ?? StoreStatus.APPROVED;
    const slug = await this.uniqueSlug(dto.name);
    const actor = RequestContext.get()?.userId ?? null;
    const buildStore = (manager: EntityManager) =>
      manager.save(
        manager.create(HardwareStore, {
          name: dto.name,
          slug,
          description: dto.description ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          streetAddress: dto.streetAddress,
          suburb: dto.suburb ?? null,
          city: dto.city,
          province: dto.province,
          postalCode: dto.postalCode ?? null,
          location: toPoint(dto.latitude, dto.longitude),
          operatingHours: dto.operatingHours ?? DEFAULT_OPERATING_HOURS,
          commissionPercent: dto.commissionPercent ?? null,
          status,
          isActive: true,
          acceptingOrders: true,
          approvedAt: status === StoreStatus.APPROVED ? new Date() : null,
          approvedBy: status === StoreStatus.APPROVED ? actor : null,
        }),
      );

    let created!: HardwareStore;
    let credentials: CreatedStore['ownerCredentials'];

    if (!dto.owner) {
      created = await this.dataSource.transaction(buildStore);
    } else {
      const owner = dto.owner;
      const existing = await this.users.findByEmail(owner.email);
      if (existing) {
        await this.dataSource.transaction(async (manager) => {
          created = await buildStore(manager);
          await this.users.addRole(existing.id, Role.STORE, manager);
          await manager.insert(StoreStaff, {
            storeId: created.id,
            userId: existing.id,
            role: StoreStaffRole.OWNER,
          });
        });
      } else {
        const password = owner.password ?? generateTemporaryPassword();
        await this.auth.createAccount(
          {
            email: owner.email,
            password,
            firstName: owner.firstName,
            lastName: owner.lastName,
            phone: owner.phone,
          },
          [Role.STORE],
          async (manager, user) => {
            created = await buildStore(manager);
            await manager.insert(StoreStaff, {
              storeId: created.id,
              userId: user.id,
              role: StoreStaffRole.OWNER,
            });
          },
        );
        if (!owner.password)
          credentials = { email: owner.email.toLowerCase(), temporaryPassword: password };
      }
    }

    await this.audit.record({
      action: 'store.create',
      entityType: 'store',
      entityId: created.id,
      after: { name: created.name, city: created.city, status, owner: dto.owner?.email },
    });
    return { store: await this.getAdmin(created.id), ownerCredentials: credentials };
  }

  async update(id: string, dto: UpdateStoreDto): Promise<StoreAdminDto> {
    const store = await this.load(id);
    const before = {
      name: store.name,
      city: store.city,
      commissionPercent: store.commissionPercent,
    };
    const patch: Partial<HardwareStore> = {};
    for (const key of [
      'name',
      'description',
      'phone',
      'email',
      'streetAddress',
      'suburb',
      'city',
      'province',
      'postalCode',
      'operatingHours',
      'commissionPercent',
    ] as const) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const current = store.location.coordinates;
      patch.location = toPoint(dto.latitude ?? current[1], dto.longitude ?? current[0]);
    }
    if (Object.keys(patch).length) await this.stores.update({ id }, patch);
    await this.audit.record({
      action: 'store.update',
      entityType: 'store',
      entityId: id,
      before,
      after: patch,
    });
    return this.getAdmin(id);
  }

  async setStatus(id: string, status: StoreStatus, reason?: string): Promise<StoreAdminDto> {
    const store = await this.load(id);
    if (status === StoreStatus.REJECTED && !reason?.trim()) {
      throw badRequestFromProblems([
        'Give a reason when rejecting a store so the owner knows what to fix',
      ]);
    }
    const actor = RequestContext.get()?.userId ?? null;
    await this.stores.update(
      { id },
      {
        status,
        rejectionReason: status === StoreStatus.REJECTED ? reason!.trim() : null,
        approvedAt: status === StoreStatus.APPROVED ? new Date() : null,
        approvedBy: status === StoreStatus.APPROVED ? actor : null,
      },
    );
    await this.audit.record({
      action: `store.${status.toLowerCase()}`,
      entityType: 'store',
      entityId: id,
      before: { status: store.status },
      after: { status, reason },
    });
    this.events.emit('store.status_changed', { storeId: id, status, reason, actorUserId: actor });
    return this.getAdmin(id);
  }

  async setActive(id: string, isActive: boolean): Promise<StoreAdminDto> {
    const store = await this.load(id);
    await this.stores.update({ id }, { isActive });
    await this.audit.record({
      action: isActive ? 'store.activate' : 'store.suspend',
      entityType: 'store',
      entityId: id,
      before: { isActive: store.isActive },
      after: { isActive },
    });
    return this.getAdmin(id);
  }

  async remove(id: string): Promise<void> {
    const store = await this.load(id);
    const [{ open }] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS open FROM information_schema.tables WHERE table_name = 'orders'`,
    )) as Array<{ open: number }>;
    if (open) {
      const [{ n }] = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS n FROM orders WHERE store_id = $1 AND order_status NOT IN ('DELIVERED','CANCELLED','REFUNDED')`,
        [id],
      )) as Array<{ n: number }>;
      if (n > 0)
        throw new ConflictException(
          `This store has ${n} order${n === 1 ? '' : 's'} in progress. Finish or cancel them first, or suspend the store instead.`,
        );
    }
    await this.stores.update({ id }, { isActive: false });
    await this.stores.softRemove(store);
    await this.audit.record({
      action: 'store.delete',
      entityType: 'store',
      entityId: id,
      before: { name: store.name },
    });
  }

  async setImage(
    id: string,
    kind: 'logo' | 'banner',
    file: UploadedFile | undefined,
  ): Promise<StoreAdminDto> {
    const store = await this.load(id);
    const stored = await this.storage.saveImage(file, 'stores');
    const field = kind === 'logo' ? 'logoUrl' : 'bannerUrl';
    const previous = store[field];
    await this.stores.update({ id }, { [field]: stored.url });
    if (previous?.startsWith('/uploads/'))
      await this.storage.delete(previous.replace('/uploads/', ''), 'public');
    await this.audit.record({ action: `store.${kind}`, entityType: 'store', entityId: id });
    return this.getAdmin(id);
  }

  // -------------------------------------------------------------------------------------------
  // Store portal ("my store")
  // -------------------------------------------------------------------------------------------

  async updateOwn(storeId: string, dto: UpdateOwnStoreDto): Promise<StoreAdminDto> {
    const store = await this.load(storeId);
    const patch: Partial<HardwareStore> = {};
    for (const key of [
      'description',
      'phone',
      'email',
      'operatingHours',
      'acceptingOrders',
    ] as const) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }
    if (Object.keys(patch).length) await this.stores.update({ id: storeId }, patch);
    await this.audit.record({
      action: 'store.update_own',
      entityType: 'store',
      entityId: storeId,
      before: { acceptingOrders: store.acceptingOrders },
      after: patch,
    });
    return this.getAdmin(storeId);
  }

  /** Stores (by id) that currently trade – used to validate cart/checkout. */
  async findVisibleByIds(ids: string[]): Promise<HardwareStore[]> {
    if (!ids.length) return [];
    return this.stores
      .createQueryBuilder('s')
      .where(VISIBLE_STORE_SQL)
      .andWhere({ id: In(ids) })
      .getMany();
  }
}
