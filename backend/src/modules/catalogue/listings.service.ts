import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InventoryReason, ListingDto, Paginated } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { badRequestFromProblems } from '../../common/utils/problems';
import { likeEscape, searchTokens } from '../../common/utils/query';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { HardwareStore } from '../stores/entities/hardware-store.entity';
import { CreateListingDto, ListingQueryDto, UpdateListingDto } from './catalogue.dto';
import { toListingDto } from './catalogue.mapper';
import { CategoriesService } from './categories.service';
import { Product } from './entities/product.entity';
import { StoreProduct } from './entities/store-product.entity';
import { validateListingRules } from './listing-rules';

const RELATIONS = { product: { category: true, images: true }, store: true } as const;

/** A store's offers: store-specific price, sale price, quantity limits and availability. */
@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(StoreProduct) private readonly repo: Repository<StoreProduct>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(HardwareStore) private readonly stores: Repository<HardwareStore>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  private async load(id: string, storeId?: string): Promise<StoreProduct> {
    const listing = await this.repo.findOne({
      where: { id, ...(storeId ? { storeId } : {}) },
      relations: RELATIONS,
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async get(id: string, storeId?: string): Promise<ListingDto> {
    return toListingDto(await this.load(id, storeId));
  }

  /** Creates a store's offer for a product. Opening stock is written through the inventory ledger. */
  async create(storeId: string, dto: CreateListingDto): Promise<ListingDto> {
    const store = await this.stores.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const product = await this.products.findOne({ where: { id: dto.productId } });
    if (!product || !product.isActive)
      throw new NotFoundException('Product not found in the catalogue');
    if (await this.repo.exists({ where: { storeId, productId: dto.productId } })) {
      throw new ConflictException(`${store.name} already lists "${product.name}"`);
    }

    const rules = {
      price: dto.price,
      salePrice: dto.salePrice ?? null,
      minimumQuantity: dto.minimumQuantity ?? 1,
      maximumQuantity: dto.maximumQuantity ?? null,
      lowStockThreshold: dto.lowStockThreshold ?? 5,
    };
    const problems = validateListingRules(rules);
    if (problems.length) throw badRequestFromProblems(problems);

    const id = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(StoreProduct, {
          storeId,
          productId: dto.productId,
          storeSku: dto.storeSku ?? null,
          price: rules.price,
          salePrice: rules.salePrice,
          stockQuantity: 0,
          minimumQuantity: rules.minimumQuantity,
          maximumQuantity: rules.maximumQuantity,
          lowStockThreshold: rules.lowStockThreshold,
          available: dto.available ?? true,
        }),
      );
      if (dto.stockQuantity && dto.stockQuantity > 0) {
        await this.inventory.adjust(
          {
            storeProductId: saved.id,
            setTo: dto.stockQuantity,
            reason: InventoryReason.INITIAL_STOCK,
            note: 'Opening stock',
          },
          manager,
        );
      }
      return saved.id;
    });
    const created = await this.load(id);
    await this.audit.record({
      action: 'listing.create',
      entityType: 'store_product',
      entityId: id,
      after: {
        storeId,
        productId: dto.productId,
        price: dto.price,
        salePrice: dto.salePrice,
        stock: dto.stockQuantity ?? 0,
      },
    });
    return toListingDto(created);
  }

  /** Stock is deliberately NOT editable here – it only changes through InventoryService (ledger). */
  async update(id: string, dto: UpdateListingDto, storeId?: string): Promise<ListingDto> {
    const listing = await this.load(id, storeId);
    const before = {
      price: listing.price,
      salePrice: listing.salePrice,
      min: listing.minimumQuantity,
      max: listing.maximumQuantity,
      available: listing.available,
    };

    const next = {
      price: dto.price ?? listing.price,
      salePrice: dto.salePrice !== undefined ? dto.salePrice : listing.salePrice,
      minimumQuantity: dto.minimumQuantity ?? listing.minimumQuantity,
      maximumQuantity:
        dto.maximumQuantity !== undefined ? dto.maximumQuantity : listing.maximumQuantity,
      lowStockThreshold: dto.lowStockThreshold ?? listing.lowStockThreshold,
    };
    const problems = validateListingRules(next);
    if (problems.length) throw badRequestFromProblems(problems);

    listing.price = next.price;
    listing.salePrice = next.salePrice;
    listing.minimumQuantity = next.minimumQuantity;
    listing.maximumQuantity = next.maximumQuantity;
    listing.lowStockThreshold = next.lowStockThreshold;
    if (dto.storeSku !== undefined) listing.storeSku = dto.storeSku;
    if (dto.available !== undefined) listing.available = dto.available;
    // Save only the scalar columns (relations were loaded for the response, not for persistence).
    await this.repo.update(
      { id },
      {
        price: listing.price,
        salePrice: listing.salePrice,
        minimumQuantity: listing.minimumQuantity,
        maximumQuantity: listing.maximumQuantity,
        lowStockThreshold: listing.lowStockThreshold,
        storeSku: listing.storeSku,
        available: listing.available,
      },
    );
    await this.audit.record({
      action: 'listing.update',
      entityType: 'store_product',
      entityId: id,
      before,
      after: {
        price: next.price,
        salePrice: next.salePrice,
        min: next.minimumQuantity,
        max: next.maximumQuantity,
        available: listing.available,
      },
    });
    return toListingDto(await this.load(id));
  }

  async remove(id: string, storeId?: string): Promise<void> {
    const listing = await this.load(id, storeId);
    await this.repo.softRemove(listing);
    await this.audit.record({
      action: 'listing.delete',
      entityType: 'store_product',
      entityId: id,
      before: { storeId: listing.storeId, productId: listing.productId },
    });
  }

  /** Listings for the store portal (scope.storeId set) or the admin console (any store). */
  async list(query: ListingQueryDto, scope: { storeId?: string }): Promise<Paginated<ListingDto>> {
    const qb = this.repo
      .createQueryBuilder('sp')
      .innerJoinAndSelect('sp.product', 'p', 'p.deleted_at IS NULL')
      .innerJoinAndSelect('p.category', 'c')
      .leftJoinAndSelect('p.images', 'img')
      .innerJoinAndSelect('sp.store', 's');
    const storeId = scope.storeId ?? query.storeId;
    if (storeId) qb.andWhere('sp.store_id = :storeId', { storeId });
    for (const [i, token] of searchTokens(query.search).entries()) {
      qb.andWhere(
        `(p.name ILIKE :t${i} OR p.sku ILIKE :t${i} OR p.brand ILIKE :t${i} OR sp.store_sku ILIKE :t${i})`,
        {
          [`t${i}`]: `%${likeEscape(token)}%`,
        },
      );
    }
    if (query.categoryId)
      qb.andWhere('p.category_id IN (:...cats)', {
        cats: await this.categories.descendantIds(query.categoryId),
      });
    if (query.available !== undefined)
      qb.andWhere('sp.available = :available', { available: query.available });
    if (query.stock === 'out') qb.andWhere('sp.stock_quantity = 0');
    if (query.stock === 'low')
      qb.andWhere('sp.stock_quantity > 0 AND sp.stock_quantity <= sp.low_stock_threshold');
    if (query.stock === 'in') qb.andWhere('sp.stock_quantity > sp.low_stock_threshold');
    qb.orderBy('p.name', 'ASC').addOrderBy('sp.id', 'ASC').skip(query.offset).take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    return toPaginated(
      rows.map((r) => toListingDto(r)),
      total,
      query.page,
      query.limit,
    );
  }

  /** How many listings a store has (used by dashboards and store summaries). */
  countForStore(storeId: string): Promise<number> {
    return this.repo.count({ where: { storeId, deletedAt: IsNull() } });
  }
}
