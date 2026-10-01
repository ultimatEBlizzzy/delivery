import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryMovementDto, InventoryReason, Paginated } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { StoreProduct } from '../catalogue/entities/store-product.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { AdjustStockDto, MovementQueryDto } from './dto/inventory.dto';

export interface AdjustStockInput {
  storeProductId: string;
  /** Relative change (positive adds, negative removes). Exactly one of `delta` / `setTo` is required. */
  delta?: number;
  /** Absolute stock level to set. */
  setTo?: number;
  reason: InventoryReason;
  note?: string | null;
  orderId?: string | null;
  actorUserId?: string | null;
}

export interface AdjustStockResult {
  storeProductId: string;
  previousQuantity: number;
  stockQuantity: number;
  movement: InventoryMovement | null;
}

/**
 * The ONLY code allowed to change `store_products.stock_quantity`. It locks the listing row
 * (`SELECT … FOR UPDATE`), refuses to go below zero and writes a ledger entry in the same
 * transaction, which is what makes overselling impossible under concurrency.
 */
@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InventoryMovement) private readonly movements: Repository<InventoryMovement>,
  ) {}

  adjust(input: AdjustStockInput, manager?: EntityManager): Promise<AdjustStockResult> {
    if (manager) return this.apply(manager, input);
    return this.dataSource.transaction((m) => this.apply(m, input));
  }

  private async apply(manager: EntityManager, input: AdjustStockInput): Promise<AdjustStockResult> {
    if ((input.delta === undefined) === (input.setTo === undefined)) {
      throw new BadRequestException('Provide either a stock change or a new stock level');
    }
    const listing = await manager
      .createQueryBuilder(StoreProduct, 'sp')
      .setLock('pessimistic_write')
      .where('sp.id = :id', { id: input.storeProductId })
      .getOne();
    if (!listing) throw new NotFoundException('Product listing not found');

    const target =
      input.setTo !== undefined ? input.setTo : listing.stockQuantity + (input.delta as number);
    if (!Number.isInteger(target) || target < 0) {
      throw new ConflictException(
        input.setTo !== undefined
          ? 'Stock cannot be negative'
          : `Cannot remove ${Math.abs(input.delta as number)} – only ${listing.stockQuantity} in stock`,
      );
    }
    const change = target - listing.stockQuantity;
    if (change === 0) {
      return {
        storeProductId: listing.id,
        previousQuantity: target,
        stockQuantity: target,
        movement: null,
      };
    }

    await manager.update(StoreProduct, { id: listing.id }, { stockQuantity: target });
    const movement = await manager.save(
      manager.create(InventoryMovement, {
        storeProductId: listing.id,
        change,
        quantityAfter: target,
        reason: input.reason,
        orderId: input.orderId ?? null,
        actorUserId: input.actorUserId ?? null,
        note: input.note?.trim() || null,
      }),
    );
    return {
      storeProductId: listing.id,
      previousQuantity: listing.stockQuantity,
      stockQuantity: target,
      movement,
    };
  }

  /** Applies a person's ADD / REMOVE / SET request (validated by AdjustStockDto) through the ledger. */
  adjustFromRequest(
    storeProductId: string,
    dto: AdjustStockDto,
    actorUserId: string,
  ): Promise<AdjustStockResult> {
    if (dto.mode !== 'SET' && dto.quantity < 1)
      throw new BadRequestException('Enter a quantity of at least 1');
    return this.adjust({
      storeProductId,
      ...(dto.mode === 'SET'
        ? { setTo: dto.quantity }
        : { delta: dto.mode === 'ADD' ? dto.quantity : -dto.quantity }),
      reason: dto.reason,
      note: dto.note,
      actorUserId,
    });
  }

  /** Ledger for one listing or a whole store, newest first. */
  async listMovements(
    query: MovementQueryDto,
    scope: { storeId?: string },
  ): Promise<Paginated<InventoryMovementDto>> {
    const qb = this.movements
      .createQueryBuilder('m')
      .innerJoin('m.storeProduct', 'sp')
      .innerJoin('sp.product', 'p')
      .leftJoin('users', 'u', 'u.id = m.actor_user_id')
      .select([
        'm.id AS id',
        'm.store_product_id AS "storeProductId"',
        'm.change AS change',
        'm.quantity_after AS "quantityAfter"',
        'm.reason AS reason',
        'm.order_id AS "orderId"',
        'm.note AS note',
        'm.created_at AS "createdAt"',
        'p.id AS "productId"',
        'p.name AS "productName"',
        'p.sku AS "productSku"',
        `NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS "actorName"`,
      ])
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC');
    // `withDeleted` is not needed: the ledger of removed listings is still readable for the audit trail.
    if (scope.storeId) qb.andWhere('sp.store_id = :storeId', { storeId: scope.storeId });
    if (query.storeProductId)
      qb.andWhere('m.store_product_id = :listing', { listing: query.storeProductId });
    if (query.storeId && !scope.storeId)
      qb.andWhere('sp.store_id = :filterStore', { filterStore: query.storeId });
    if (query.reason) qb.andWhere('m.reason = :reason', { reason: query.reason });

    const total = await qb
      .clone()
      .select('COUNT(*)', 'count')
      .orderBy()
      .getRawOne<{ count: number }>();
    const rows = await qb.offset(query.offset).limit(query.limit).getRawMany();
    const data: InventoryMovementDto[] = rows.map((r) => ({
      id: r.id,
      storeProductId: r.storeProductId,
      change: Number(r.change),
      quantityAfter: Number(r.quantityAfter),
      reason: r.reason,
      orderId: r.orderId,
      note: r.note,
      actorName: r.actorName,
      createdAt: new Date(r.createdAt).toISOString(),
      product: { id: r.productId, name: r.productName, sku: r.productSku },
    }));
    return toPaginated(data, Number(total?.count ?? 0), query.page, query.limit);
  }
}
