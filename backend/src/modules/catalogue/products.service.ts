import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { CatalogueProductDto, Paginated, ProductDto } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { likeEscape, searchTokens } from '../../common/utils/query';
import { slugify } from '../../common/utils/slug';
import { AuditService } from '../audit/audit.service';
import {
  AdminProductQueryDto,
  CatalogueSearchQueryDto,
  CreateProductDto,
  UpdateProductDto,
} from './catalogue.dto';
import { toProductDto } from './catalogue.mapper';
import { CategoriesService } from './categories.service';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { StoreProduct } from './entities/store-product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(StoreProduct) private readonly listings: Repository<StoreProduct>,
    @InjectRepository(ProductImage) private readonly images: Repository<ProductImage>,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  private async uniqueSlug(name: string, sku: string, excludeId?: string): Promise<string> {
    const base = slugify(name) || slugify(sku) || 'product';
    for (let i = 1; ; i++) {
      const candidate =
        i === 1 ? base : i === 2 ? `${base}-${slugify(sku)}` : `${base}-${slugify(sku)}-${i}`;
      const existing = await this.products.findOne({
        where: { slug: candidate },
        withDeleted: true,
      });
      if (!existing || existing.id === excludeId) return candidate;
    }
  }

  private async load(id: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true, images: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertSkuFree(sku: string, excludeId?: string): Promise<void> {
    const clash = await this.products.findOne({ where: { sku }, withDeleted: true });
    if (clash && clash.id !== excludeId)
      throw new ConflictException(`SKU ${sku} is already used by "${clash.name}"`);
  }

  /** Creates a global catalogue product. `createdByStoreId` marks products created from the store portal. */
  async create(
    dto: CreateProductDto,
    opts: { createdByStoreId?: string } = {},
  ): Promise<ProductDto> {
    await this.categories.getOrFail(dto.categoryId).catch(() => {
      throw new NotFoundException('Category not found');
    });
    await this.assertSkuFree(dto.sku);
    const saved = await this.products.save(
      this.products.create({
        categoryId: dto.categoryId,
        name: dto.name,
        sku: dto.sku,
        slug: await this.uniqueSlug(dto.name, dto.sku),
        brand: dto.brand ?? null,
        description: dto.description ?? null,
        unit: dto.unit,
        packSize: dto.packSize ?? null,
        weightKg: dto.weightKg,
        lengthCm: dto.lengthCm ?? null,
        widthCm: dto.widthCm ?? null,
        heightCm: dto.heightCm ?? null,
        isActive: dto.isActive ?? true,
        createdByStoreId: opts.createdByStoreId ?? null,
      }),
    );
    await this.audit.record({
      action: 'product.create',
      entityType: 'product',
      entityId: saved.id,
      after: saved,
    });
    return toProductDto(await this.load(saved.id), { listingCount: 0 });
  }

  /**
   * Updates a product. When `opts.storeId` is set (a store editing from its portal) the store may only
   * change products it created itself that no other store has listed – shared catalogue data is admin-owned.
   */
  async update(
    id: string,
    dto: UpdateProductDto,
    opts: { storeId?: string } = {},
  ): Promise<ProductDto> {
    const product = await this.load(id);
    if (opts.storeId) {
      const others = await this.listings.count({
        where: { productId: id, storeId: Not(opts.storeId), deletedAt: IsNull() },
      });
      if (product.createdByStoreId !== opts.storeId || others > 0) {
        throw new ForbiddenException(
          'This product is shared with other stores. Ask an administrator to change it.',
        );
      }
    }
    const before = {
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      brand: product.brand,
      unit: product.unit,
      weightKg: product.weightKg,
      isActive: product.isActive,
    };
    const patch: Partial<Product> = {};
    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      await this.categories.getOrFail(dto.categoryId).catch(() => {
        throw new NotFoundException('Category not found');
      });
      patch.categoryId = dto.categoryId;
    }
    if (dto.sku && dto.sku !== product.sku) {
      await this.assertSkuFree(dto.sku, id);
      patch.sku = dto.sku;
    }
    if (dto.name !== undefined && dto.name !== product.name) {
      patch.name = dto.name;
      patch.slug = await this.uniqueSlug(dto.name, patch.sku ?? product.sku, id);
    }
    for (const key of [
      'brand',
      'description',
      'unit',
      'packSize',
      'weightKg',
      'lengthCm',
      'widthCm',
      'heightCm',
      'isActive',
    ] as const) {
      if (dto[key] !== undefined) Object.assign(patch, { [key]: dto[key] });
    }
    if (Object.keys(patch).length) await this.products.update({ id }, patch);
    await this.audit.record({
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      before,
      after: patch,
    });
    return toProductDto(await this.load(id), { listingCount: await this.countListings(id) });
  }

  private countListings(productId: string): Promise<number> {
    return this.listings.count({ where: { productId, deletedAt: IsNull() } });
  }

  async remove(id: string): Promise<void> {
    const product = await this.load(id);
    const listingCount = await this.countListings(id);
    if (listingCount > 0) {
      throw new ConflictException(
        `${listingCount} store${listingCount === 1 ? ' lists' : 's list'} this product. Deactivate it instead, or remove the listings first.`,
      );
    }
    await this.products.softRemove(product);
    await this.audit.record({
      action: 'product.delete',
      entityType: 'product',
      entityId: id,
      before: { name: product.name, sku: product.sku },
    });
  }

  async getAdmin(id: string): Promise<ProductDto> {
    return toProductDto(await this.load(id), { listingCount: await this.countListings(id) });
  }

  async listAdmin(query: AdminProductQueryDto): Promise<Paginated<ProductDto>> {
    const qb = this.products.createQueryBuilder('p').leftJoinAndSelect('p.category', 'c');
    for (const [i, token] of searchTokens(query.search).entries()) {
      qb.andWhere(`(p.name ILIKE :t${i} OR p.sku ILIKE :t${i} OR p.brand ILIKE :t${i})`, {
        [`t${i}`]: `%${likeEscape(token)}%`,
      });
    }
    if (query.categoryId)
      qb.andWhere('p.category_id IN (:...cats)', {
        cats: await this.categories.descendantIds(query.categoryId),
      });
    if (query.isActive !== undefined)
      qb.andWhere('p.is_active = :active', { active: query.isActive });
    qb.orderBy('p.name', 'ASC').addOrderBy('p.id', 'ASC').skip(query.offset).take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);
    const [images, counts] = await Promise.all([this.imagesFor(ids), this.listingCounts(ids)]);
    const data = rows.map((p) => {
      p.images = images.get(p.id) ?? [];
      return toProductDto(p, { listingCount: counts.get(p.id) ?? 0 });
    });
    return toPaginated(data, total, query.page, query.limit);
  }

  private async imagesFor(productIds: string[]): Promise<Map<string, ProductImage[]>> {
    const map = new Map<string, ProductImage[]>();
    if (!productIds.length) return map;
    for (const image of await this.images.find({
      where: { productId: In(productIds) },
      order: { sortOrder: 'ASC' },
    })) {
      map.set(image.productId, [...(map.get(image.productId) ?? []), image]);
    }
    return map;
  }

  private async listingCounts(productIds: string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();
    const rows = await this.listings
      .createQueryBuilder('sp')
      .select('sp.product_id', 'productId')
      .addSelect('COUNT(*)', 'count')
      .where('sp.product_id IN (:...ids)', { ids: productIds })
      .groupBy('sp.product_id')
      .getRawMany<{ productId: string; count: number }>();
    return new Map(rows.map((r) => [r.productId, Number(r.count)]));
  }

  /** Store portal: search the global catalogue to find a product to list (or discover it is missing). */
  async searchForStore(
    storeId: string,
    query: CatalogueSearchQueryDto,
  ): Promise<Paginated<CatalogueProductDto>> {
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.is_active = true');
    for (const [i, token] of searchTokens(query.search).entries()) {
      qb.andWhere(`(p.name ILIKE :t${i} OR p.sku ILIKE :t${i} OR p.brand ILIKE :t${i})`, {
        [`t${i}`]: `%${likeEscape(token)}%`,
      });
    }
    if (query.categoryId)
      qb.andWhere('p.category_id IN (:...cats)', {
        cats: await this.categories.descendantIds(query.categoryId),
      });
    qb.orderBy('p.name', 'ASC').addOrderBy('p.id', 'ASC').skip(query.offset).take(query.limit);
    const [rows, total] = await qb.getManyAndCount();
    const ids = rows.map((r) => r.id);
    const images = await this.imagesFor(ids);
    const mine = ids.length
      ? await this.listings.find({
          where: { storeId, productId: In(ids), deletedAt: IsNull() },
          select: { id: true, productId: true },
        })
      : [];
    const listingByProduct = new Map(mine.map((l) => [l.productId, l.id]));
    const data = rows.map((p) => {
      p.images = images.get(p.id) ?? [];
      return {
        ...toProductDto(p),
        listedByStore: listingByProduct.has(p.id),
        listingId: listingByProduct.get(p.id) ?? null,
      };
    });
    return toPaginated(data, total, query.page, query.limit);
  }

  /** Used by the image endpoints: store users may only manage images of products they own. */
  async assertStoreOwnsProduct(storeId: string, productId: string): Promise<void> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const others = await this.listings.count({
      where: { productId, storeId: Not(storeId), deletedAt: IsNull() },
    });
    if (product.createdByStoreId !== storeId || others > 0) {
      throw new ForbiddenException(
        'This product is shared with other stores. Ask an administrator to change its images.',
      );
    }
  }

  async assertExists(productId: string): Promise<void> {
    if (!(await this.products.exists({ where: { id: productId } })))
      throw new NotFoundException('Product not found');
  }
}
