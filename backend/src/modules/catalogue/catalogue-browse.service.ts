import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ListingDto, Paginated, ProductDetailDto, StoreStatus } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { GeoService } from '../geo/geo.service';
import { SQL_POINT } from '../../common/utils/geo';
import { likeEscape, searchTokens } from '../../common/utils/query';
import { isUUID } from 'class-validator';
import { toProductDto, toListingDto } from './catalogue.mapper';
import { ProductDetailQueryDto, PublicListingQueryDto } from './catalogue.dto';
import { CategoriesService } from './categories.service';
import { Product } from './entities/product.entity';
import { StoreProduct } from './entities/store-product.entity';
import { VISIBLE_LISTING_SQL, VISIBLE_PRODUCT_SQL, VISIBLE_STORE_SQL } from './visibility';

const EFFECTIVE_PRICE_SQL = 'COALESCE(sp.sale_price, sp.price)';

/**
 * Customer-facing catalogue queries. Everything here only ever returns offers that a customer is
 * allowed to see: approved + active store, active product, listing switched on.
 */
@Injectable()
export class CatalogueBrowseService {
  constructor(
    @InjectRepository(StoreProduct) private readonly listings: Repository<StoreProduct>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly categories: CategoriesService,
    private readonly geo: GeoService,
  ) {}

  /** Filtered, sorted, paginated store offers. */
  async searchListings(q: PublicListingQueryDto): Promise<Paginated<ListingDto>> {
    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    const point = hasPoint ? { lat: q.lat, lng: q.lng } : {};

    const base = this.listings
      .createQueryBuilder('sp')
      .innerJoin('sp.product', 'p', VISIBLE_PRODUCT_SQL)
      .innerJoin('p.category', 'c')
      .innerJoin('sp.store', 's', VISIBLE_STORE_SQL)
      .where(VISIBLE_LISTING_SQL);

    const tokens = searchTokens(q.search);
    tokens.forEach((token, i) => {
      base.andWhere(
        `(p.name ILIKE :t${i} OR p.brand ILIKE :t${i} OR p.sku ILIKE :t${i} OR c.name ILIKE :t${i})`,
        {
          [`t${i}`]: `%${likeEscape(token)}%`,
        },
      );
    });
    if (q.categoryId)
      base.andWhere('p.category_id IN (:...cats)', {
        cats: await this.categories.descendantIds(q.categoryId),
      });
    if (q.storeId) base.andWhere('sp.store_id = :storeId', { storeId: q.storeId });
    if (q.minPrice !== undefined)
      base.andWhere(`${EFFECTIVE_PRICE_SQL} >= :minPrice`, { minPrice: q.minPrice });
    if (q.maxPrice !== undefined)
      base.andWhere(`${EFFECTIVE_PRICE_SQL} <= :maxPrice`, { maxPrice: q.maxPrice });
    if (q.inStock) base.andWhere('sp.stock_quantity >= sp.minimum_quantity');
    if (hasPoint && q.radiusKm) {
      const near = await this.geo.idsWithinRadius({
        table: 'hardware_stores',
        lat: q.lat!,
        lng: q.lng!,
        radiusKm: q.radiusKm,
        where: VISIBLE_STORE_SQL,
      });
      if (near.size === 0) return toPaginated([], 0, q.page, q.limit);
      base.andWhere('sp.store_id = ANY(:nearStoreIds)', { nearStoreIds: [...near.keys()] });
    }

    const sort = q.sort ?? (tokens.length ? 'relevance' : hasPoint ? 'distance' : 'name');
    const total = Number(
      (await base.clone().select('COUNT(sp.id)', 'count').getRawOne<{ count: number }>())?.count ??
        0,
    );

    const page = base.clone().select('sp.id', 'id');
    if (hasPoint)
      page.addSelect(`ST_Distance(s.location, ${SQL_POINT})`, 'distance_m').setParameters(point);
    switch (sort) {
      case 'price_asc':
        page.addSelect(EFFECTIVE_PRICE_SQL, 'sort_price').orderBy('sort_price', 'ASC');
        break;
      case 'price_desc':
        page.addSelect(EFFECTIVE_PRICE_SQL, 'sort_price').orderBy('sort_price', 'DESC');
        break;
      case 'distance':
        if (hasPoint) page.orderBy('distance_m', 'ASC');
        else page.orderBy('p.name', 'ASC');
        break;
      case 'relevance': {
        const text = (q.search ?? '').trim();
        page
          .addSelect(
            'CASE WHEN p.name ILIKE :prefix THEN 0 WHEN p.name ILIKE :contains THEN 1 ELSE 2 END',
            'sort_rank',
          )
          .setParameters({ prefix: `${likeEscape(text)}%`, contains: `%${likeEscape(text)}%` })
          .orderBy('sort_rank', 'ASC')
          .addOrderBy(EFFECTIVE_PRICE_SQL, 'ASC');
        break;
      }
      default:
        page.orderBy('p.name', 'ASC');
    }
    page.addOrderBy('sp.id', 'ASC').offset(q.offset).limit(q.limit);
    const rows = await page.getRawMany<{ id: string; distance_m?: number }>();

    const ids = rows.map((r) => r.id);
    const distanceById = new Map(
      rows.map((r) => [
        r.id,
        r.distance_m === undefined || r.distance_m === null ? null : Number(r.distance_m) / 1000,
      ]),
    );
    const entities = ids.length
      ? await this.listings.find({
          where: { id: In(ids) },
          relations: { product: { category: true, images: true }, store: true },
        })
      : [];
    const byId = new Map(entities.map((e) => [e.id, e]));
    const data = ids
      .map((id) => byId.get(id))
      .filter((e): e is StoreProduct => !!e)
      .map((e) =>
        toListingDto(e, { distanceKm: hasPoint ? (distanceById.get(e.id) ?? null) : undefined }),
      );
    return toPaginated(data, total, q.page, q.limit);
  }

  /** A product with its category breadcrumb and every store's offer (cheapest first, or nearest first). */
  async productDetail(idOrSlug: string, q: ProductDetailQueryDto): Promise<ProductDetailDto> {
    const product = await this.products.findOne({
      where: isUUID(idOrSlug)
        ? { id: idOrSlug, isActive: true }
        : { slug: idOrSlug, isActive: true },
      relations: { category: true, images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    const qb = this.listings
      .createQueryBuilder('sp')
      .innerJoin('sp.store', 's', VISIBLE_STORE_SQL)
      .where(VISIBLE_LISTING_SQL)
      .andWhere('sp.product_id = :pid', { pid: product.id })
      .select('sp.id', 'id');
    if (hasPoint)
      qb.addSelect(`ST_Distance(s.location, ${SQL_POINT})`, 'distance_m').setParameters({
        lat: q.lat,
        lng: q.lng,
      });
    qb.addSelect(EFFECTIVE_PRICE_SQL, 'sort_price')
      .orderBy('sort_price', 'ASC')
      .addOrderBy('sp.id', 'ASC');
    const rows = await qb.getRawMany<{ id: string; distance_m?: number }>();
    const ids = rows.map((r) => r.id);
    const distance = new Map(
      rows.map((r) => [
        r.id,
        r.distance_m === undefined || r.distance_m === null ? null : Number(r.distance_m) / 1000,
      ]),
    );
    const entities = ids.length
      ? await this.listings.find({
          where: { id: In(ids) },
          relations: { product: { category: true, images: true }, store: true },
        })
      : [];
    const byId = new Map(entities.map((e) => [e.id, e]));
    const offers = ids
      .map((id) => byId.get(id))
      .filter((e): e is StoreProduct => !!e)
      .map((e) =>
        toListingDto(e, { distanceKm: hasPoint ? (distance.get(e.id) ?? null) : undefined }),
      );

    const path = await this.categories.ancestors(product.categoryId);
    return {
      ...toProductDto(product, { listingCount: offers.length }),
      categoryPath: path.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      offers,
    };
  }

  /** Reference used by tests/other modules: the visibility predicate for stores. */
  static readonly APPROVED = StoreStatus.APPROVED;
}
