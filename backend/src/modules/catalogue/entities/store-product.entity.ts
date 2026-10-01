import { Check, Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseModel } from '../../../database/base.entity';
import { decimalTransformer } from '../../../database/transformers';
import { HardwareStore } from '../../stores/entities/hardware-store.entity';
import { Product } from './product.entity';

/**
 * A store's offer for a global product: its own price, optional sale price, stock level, order
 * quantity limits and availability switch. `stock_quantity` is the source of truth for stock;
 * every change is mirrored in the `inventory` ledger.
 */
@Entity('store_products')
@Check('chk_store_products_price', `"price" > 0`)
@Check(
  'chk_store_products_sale_price',
  `"sale_price" IS NULL OR ("sale_price" > 0 AND "sale_price" < "price")`,
)
@Check('chk_store_products_stock', `"stock_quantity" >= 0`)
@Check(
  'chk_store_products_quantities',
  `"minimum_quantity" >= 1 AND ("maximum_quantity" IS NULL OR "maximum_quantity" >= "minimum_quantity")`,
)
@Index('uq_store_products_store_product', ['storeId', 'productId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('idx_store_products_product_id', ['productId'])
@Index('idx_store_products_store_available', ['storeId', 'available'])
export class StoreProduct extends BaseModel {
  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => HardwareStore, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: HardwareStore;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  /** The store's own stock-keeping code. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  storeSku: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimalTransformer })
  price: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  salePrice: number | null;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ type: 'int', default: 1 })
  minimumQuantity: number;

  @Column({ type: 'int', nullable: true })
  maximumQuantity: number | null;

  @Column({ type: 'int', default: 5 })
  lowStockThreshold: number;

  /** The store's switch: false hides the offer from customers without deleting it. */
  @Column({ type: 'boolean', default: true })
  available: boolean;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
