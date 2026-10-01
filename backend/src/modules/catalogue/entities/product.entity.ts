import {
  Check,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseModel } from '../../../database/base.entity';
import { decimalTransformer } from '../../../database/transformers';
import { Category } from './category.entity';
import type { ProductImage } from './product-image.entity';

/**
 * Global product information (what the product IS). Store-specific price, stock and availability
 * live in StoreProduct, so many stores can sell the same product at different prices.
 */
@Entity('products')
@Check('chk_products_weight', `"weight_kg" >= 0`)
@Index('idx_products_category_id', ['categoryId'])
@Index('idx_products_active', ['isActive'])
export class Product extends BaseModel {
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 230, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** What one unit is: bag, each, box, m, litre… */
  @Column({ type: 'varchar', length: 30, default: 'each' })
  unit: string;

  /** Human-readable pack description, e.g. "50 kg bag". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  packSize: string | null;

  /** Weight of ONE unit. Drives vehicle selection and delivery pricing. */
  @Column({ type: 'numeric', precision: 10, scale: 3, default: 0, transformer: decimalTransformer })
  weightKg: number;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 1,
    nullable: true,
    transformer: decimalTransformer,
  })
  lengthCm: number | null;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 1,
    nullable: true,
    transformer: decimalTransformer,
  })
  widthCm: number | null;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 1,
    nullable: true,
    transformer: decimalTransformer,
  })
  heightCm: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Set when a store created the product (instead of an admin). */
  @Column({ type: 'uuid', nullable: true })
  createdByStoreId: string | null;

  @OneToMany('ProductImage', 'product')
  images: ProductImage[];

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
