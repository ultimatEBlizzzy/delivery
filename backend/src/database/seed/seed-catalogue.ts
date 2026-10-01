import { INestApplicationContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  DEFAULT_OPERATING_HOURS,
  DEMO_PASSWORD,
  OperatingHours,
  StoreStaffRole,
} from '@hardware-delivery/shared';
import { CategoriesService } from '../../modules/catalogue/categories.service';
import { ProductImage } from '../../modules/catalogue/entities/product-image.entity';
import { ListingsService } from '../../modules/catalogue/listings.service';
import { ProductsService } from '../../modules/catalogue/products.service';
import { StorageService } from '../../modules/storage/storage.service';
import { HardwareStore } from '../../modules/stores/entities/hardware-store.entity';
import { StoreStaffService } from '../../modules/stores/store-staff.service';
import { StoresService } from '../../modules/stores/stores.service';
import { CATEGORIES } from './data/categories';
import { PRODUCTS, SeedProduct } from './data/products';
import { EXTRA_STAFF, SeedStore, STORES } from './data/stores';
import { bannerSvg, logoSvg, productSvg } from './images';
import { createRng, hash01, round2 } from './prng';

export interface SeededStore {
  key: string;
  id: string;
  name: string;
  ownerEmail: string;
  listings: Array<{
    id: string;
    sku: string;
    productId: string;
    price: number;
    salePrice: number | null;
    stock: number;
  }>;
}

export interface CatalogueSeedResult {
  categoryIds: Map<string, string>;
  productIds: Map<string, string>;
  stores: SeededStore[];
}

const LONG_HOURS: OperatingHours = {
  ...DEFAULT_OPERATING_HOURS,
  mon: { closed: false, open: '06:30', close: '18:00' },
  tue: { closed: false, open: '06:30', close: '18:00' },
  wed: { closed: false, open: '06:30', close: '18:00' },
  thu: { closed: false, open: '06:30', close: '18:00' },
  fri: { closed: false, open: '06:30', close: '18:00' },
  sat: { closed: false, open: '07:00', close: '15:00' },
  sun: { closed: false, open: '08:00', close: '12:00' },
};

const topLevelOf = (name: string): string => {
  const top = CATEGORIES.find((c) => c.name === name || c.children.includes(name));
  return top?.name ?? name;
};

/** Decides whether a store stocks a product, deterministically, favouring its specialities. */
function stocks(store: SeedStore, product: SeedProduct): boolean {
  const special = store.specialities.some(
    (s) => s === product.category || s === topLevelOf(product.category),
  );
  const u = hash01(`${store.key}:${product.sku}:in`);
  return special ? u < 0.93 : u < store.coverage * 0.55;
}

export async function seedCatalogue(
  app: INestApplicationContext,
  log: (msg: string) => void,
): Promise<CatalogueSeedResult> {
  const categories = app.get(CategoriesService);
  const products = app.get(ProductsService);
  const listings = app.get(ListingsService);
  const storesService = app.get(StoresService);
  const staffService = app.get(StoreStaffService);
  const storage = app.get(StorageService);
  const imageRepo: Repository<ProductImage> = app.get(getRepositoryToken(ProductImage));
  const storeRepo: Repository<HardwareStore> = app.get(getRepositoryToken(HardwareStore));

  // ---- categories --------------------------------------------------------------------------
  const categoryIds = new Map<string, string>();
  const colourOf = new Map<string, string>();
  for (const [i, top] of CATEGORIES.entries()) {
    const created = await categories.create({ name: top.name, icon: top.icon, sortOrder: i * 10 });
    categoryIds.set(top.name, created.id);
    colourOf.set(top.name, top.color);
    for (const [j, child] of top.children.entries()) {
      const sub = await categories.create({ name: child, parentId: created.id, sortOrder: j * 10 });
      categoryIds.set(child, sub.id);
      colourOf.set(child, top.color);
    }
  }
  log(`  ✔ ${categoryIds.size} categories`);

  // ---- products (+ generated artwork) --------------------------------------------------------
  const productIds = new Map<string, string>();
  for (const p of PRODUCTS) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId)
      throw new Error(`Seed product ${p.sku} references unknown category "${p.category}"`);
    const created = await products.create({
      categoryId,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      unit: p.unit,
      packSize: p.packSize ?? null,
      weightKg: p.weightKg,
      lengthCm: p.dims?.[0] ?? null,
      widthCm: p.dims?.[1] ?? null,
      heightCm: p.dims?.[2] ?? null,
      description: `${p.name} (${p.packSize ?? p.unit}) by ${p.brand}. Sold by hardware stores near you – prices and availability differ per store.`,
    });
    productIds.set(p.sku, created.id);
    const svg = productSvg(p.shape, colourOf.get(p.category) ?? '#475569', p.name);
    const stored = await storage.saveTrusted(
      `products/${created.id}/${randomUUID()}.svg`,
      Buffer.from(svg),
      'image/svg+xml',
    );
    await imageRepo.save(
      imageRepo.create({
        productId: created.id,
        url: stored.url,
        storageKey: stored.key,
        alt: p.name,
        sortOrder: 0,
        isPrimary: true,
      }),
    );
  }
  log(`  ✔ ${productIds.size} products`);

  // ---- stores, owners, staff ------------------------------------------------------------------
  const seeded: SeededStore[] = [];
  for (const s of STORES) {
    const { store } = await storesService.create({
      name: s.name,
      description: s.description,
      phone: s.phone,
      email: `hello@${s.key}.demo.test`,
      streetAddress: s.streetAddress,
      suburb: s.suburb ?? null,
      city: s.city,
      province: s.province,
      postalCode: s.postalCode,
      latitude: s.latitude,
      longitude: s.longitude,
      operatingHours: s.hours === 'long' ? LONG_HOURS : DEFAULT_OPERATING_HOURS,
      commissionPercent: s.commissionPercent ?? null,
      owner: {
        email: s.ownerEmail,
        firstName: s.ownerName[0],
        lastName: s.ownerName[1],
        password: DEMO_PASSWORD,
      },
    } as never);
    const logo = await storage.saveTrusted(
      `stores/${randomUUID()}.svg`,
      Buffer.from(logoSvg(s.name, s.accent)),
      'image/svg+xml',
    );
    const banner = await storage.saveTrusted(
      `stores/${randomUUID()}.svg`,
      Buffer.from(bannerSvg(s.name, s.accent)),
      'image/svg+xml',
    );
    await storeRepo.update({ id: store.id }, { logoUrl: logo.url, bannerUrl: banner.url });
    seeded.push({ key: s.key, id: store.id, name: s.name, ownerEmail: s.ownerEmail, listings: [] });
  }
  for (const extra of EXTRA_STAFF) {
    const target = seeded.find((x) => x.key === extra.store)!;
    await staffService.add(target.id, {
      email: extra.email,
      firstName: extra.first,
      lastName: extra.last,
      password: DEMO_PASSWORD,
      role: extra.role as StoreStaffRole,
    } as never);
  }
  log(`  ✔ ${seeded.length} stores with owners and ${EXTRA_STAFF.length} extra staff accounts`);

  // ---- store-specific listings: each store prices and stocks differently ------------------------
  const stockedBy = new Map<string, number>();
  for (const s of STORES)
    for (const p of PRODUCTS)
      if (stocks(s, p)) stockedBy.set(p.sku, (stockedBy.get(p.sku) ?? 0) + 1);
  const orphans = new Set(PRODUCTS.filter((p) => !stockedBy.get(p.sku)).map((p) => p.sku)); // make sure every product is sold somewhere

  for (const s of STORES) {
    const target = seeded.find((x) => x.key === s.key)!;
    const rng = createRng(Math.floor(hash01(s.key) * 1e9));
    for (const p of PRODUCTS) {
      const included = stocks(s, p) || (s.key === 'polokwane' && orphans.has(p.sku));
      if (!included) continue;

      const noise = 0.97 + hash01(`${s.key}:${p.sku}:price`) * 0.06;
      const price = round2(p.price * s.priceFactor * noise);
      const onSale = hash01(`${s.key}:${p.sku}:sale`) < 0.12;
      const salePrice = onSale ? round2(price * (0.88 + rng() * 0.07)) : null;

      const heavy = p.weightKg > 500 ? 'bulk' : p.weightKg > 20 ? 'heavy' : 'light';
      const base =
        heavy === 'bulk'
          ? 4 + Math.floor(rng() * 9)
          : heavy === 'heavy'
            ? 20 + Math.floor(rng() * 100)
            : 40 + Math.floor(rng() * 360);
      let stock = Math.max(0, Math.round(base * s.stockFactor));
      const roll = hash01(`${s.key}:${p.sku}:stock`);
      if (roll < 0.06)
        stock = 0; // a few sold-out items
      else if (roll < 0.14) stock = 1 + Math.floor(rng() * 4); // and a few low-stock ones

      const minimumQuantity = p.bulk ?? 1;
      const maximumQuantity = p.bulk
        ? p.bulk * 40
        : heavy === 'bulk'
          ? 6
          : heavy === 'heavy'
            ? 100
            : 500;
      const created = await listings.create(target.id, {
        productId: productIds.get(p.sku)!,
        price,
        salePrice,
        stockQuantity: stock,
        minimumQuantity,
        maximumQuantity,
        lowStockThreshold: heavy === 'light' ? 10 : 5,
      });
      target.listings.push({
        id: created.id,
        sku: p.sku,
        productId: created.productId,
        price,
        salePrice,
        stock,
      });
    }
  }
  log(
    `  ✔ ${seeded.reduce((n, s) => n + s.listings.length, 0)} store listings (${seeded.map((s) => `${s.listings.length}`).join(' / ')} per store)`,
  );
  return { categoryIds, productIds, stores: seeded };
}
