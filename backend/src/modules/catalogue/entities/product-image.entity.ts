import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Product } from './product.entity';

@Entity('product_images')
@Index('idx_product_images_product_id', ['productId'])
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne('Product', 'images', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  /** Storage key, so the file can be removed when the image is deleted. Null for external URLs. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  alt: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
