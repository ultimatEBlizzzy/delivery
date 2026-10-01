import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Paginated, Role, StoreStaffDto, StoreStaffRole } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { generateTemporaryPassword } from '../../common/utils/password';
import { likeEscape, searchTokens } from '../../common/utils/query';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { HardwareStore } from './entities/hardware-store.entity';
import { StoreStaff } from './entities/store-staff.entity';
import { toStaffDto } from './store.mapper';
import { AddStaffDto, StaffQueryDto, UpdateStaffDto } from './stores.dto';

@Injectable()
export class StoreStaffService {
  constructor(
    @InjectRepository(StoreStaff) private readonly staff: Repository<StoreStaff>,
    @InjectRepository(HardwareStore) private readonly stores: Repository<HardwareStore>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async list(q: StaffQueryDto, scope: { storeId?: string }): Promise<Paginated<StoreStaffDto>> {
    const qb = this.staff
      .createQueryBuilder('st')
      .innerJoinAndSelect('st.user', 'u')
      .innerJoinAndSelect('st.store', 's');
    const storeId = scope.storeId ?? q.storeId;
    if (storeId) qb.andWhere('st.store_id = :storeId', { storeId });
    searchTokens(q.search).forEach((token, i) => {
      qb.andWhere(
        `(u.first_name ILIKE :t${i} OR u.last_name ILIKE :t${i} OR u.email ILIKE :t${i})`,
        { [`t${i}`]: `%${likeEscape(token)}%` },
      );
    });
    qb.orderBy('s.name', 'ASC')
      .addOrderBy('st.role', 'ASC')
      .addOrderBy('u.firstName', 'ASC')
      .addOrderBy('st.id', 'ASC')
      .skip(q.offset)
      .take(q.limit);
    const [rows, total] = await qb.getManyAndCount();
    return toPaginated(
      rows.map((r) => toStaffDto(r, r.store.name)),
      total,
      q.page,
      q.limit,
    );
  }

  /** Adds a staff member: links an existing account (by email) or creates a new one. */
  async add(
    storeId: string,
    dto: AddStaffDto,
  ): Promise<{ staff: StoreStaffDto; temporaryPassword?: string }> {
    const store = await this.stores.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const email = dto.email.toLowerCase();

    const existing = await this.users.findByEmail(email);
    let userId: string;
    let temporaryPassword: string | undefined;
    if (existing) {
      if (await this.staff.exists({ where: { storeId, userId: existing.id } })) {
        throw new ConflictException(`${email} is already on the staff of ${store.name}`);
      }
      userId = existing.id;
      await this.dataSource.transaction(async (manager) => {
        await this.users.addRole(existing.id, Role.STORE, manager);
        await manager.insert(StoreStaff, { storeId, userId, role: dto.role });
      });
    } else {
      const password = dto.password ?? generateTemporaryPassword();
      const created = await this.auth.createAccount(
        { email, password, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone },
        [Role.STORE],
        async (manager, user) => {
          await manager.insert(StoreStaff, { storeId, userId: user.id, role: dto.role });
        },
      );
      userId = created.id;
      if (!dto.password) temporaryPassword = password;
    }
    const row = await this.staff.findOneOrFail({
      where: { storeId, userId },
      relations: { user: true },
    });
    await this.audit.record({
      action: 'store_staff.add',
      entityType: 'store',
      entityId: storeId,
      after: { email, role: dto.role },
    });
    return { staff: toStaffDto(row, store.name), temporaryPassword };
  }

  private async load(storeId: string, staffId: string): Promise<StoreStaff> {
    const row = await this.staff.findOne({
      where: { id: staffId, storeId },
      relations: { user: true, store: true },
    });
    if (!row) throw new NotFoundException('Staff member not found');
    return row;
  }

  /** A store must always keep at least one active owner. */
  private async assertNotLastOwner(row: StoreStaff): Promise<void> {
    if (row.role !== StoreStaffRole.OWNER || !row.isActive) return;
    const owners = await this.staff.count({
      where: { storeId: row.storeId, role: StoreStaffRole.OWNER, isActive: true },
    });
    if (owners <= 1)
      throw new ConflictException(
        'A store must keep at least one active owner. Make someone else an owner first.',
      );
  }

  async update(storeId: string, staffId: string, dto: UpdateStaffDto): Promise<StoreStaffDto> {
    const row = await this.load(storeId, staffId);
    const demoting = dto.role !== undefined && dto.role !== StoreStaffRole.OWNER;
    const deactivating = dto.isActive === false;
    if (demoting || deactivating) await this.assertNotLastOwner(row);
    const before = { role: row.role, isActive: row.isActive };
    await this.staff.update(
      { id: staffId },
      {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    );
    await this.audit.record({
      action: 'store_staff.update',
      entityType: 'store',
      entityId: storeId,
      before,
      after: dto,
      metadata: { staffId },
    });
    return toStaffDto(await this.load(storeId, staffId), row.store.name);
  }

  async remove(storeId: string, staffId: string): Promise<void> {
    const row = await this.load(storeId, staffId);
    await this.assertNotLastOwner(row);
    await this.staff.delete({ id: staffId });
    await this.audit.record({
      action: 'store_staff.remove',
      entityType: 'store',
      entityId: storeId,
      before: { email: row.user.email, role: row.role },
    });
  }
}
