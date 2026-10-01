import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryReason } from '@hardware-delivery/shared';
import { StoreProduct } from '../../catalogue/entities/store-product.entity';

/**
 * Append-only stock ledger ("inventory" table). Each row records one change to
 * `store_products.stock_quantity`, who made it and why, so stock is always explainable.
 */
@Entity('inventory')
@Check('chk_inventory_change', `"change" <> 0`)
@Index('idx_inventory_listing_created', ['storeProductId', 'createdAt'])
@Index('idx_inventory_order_id', ['orderId'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeProductId: string;

  @ManyToOne(() => StoreProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_product_id' })
  storeProduct: StoreProduct;

  /** Positive = stock added, negative = stock removed. */
  @Column({ type: 'int' })
  change: number;

  @Column({ type: 'int' })
  quantityAfter: number;

  @Column({ type: 'enum', enum: InventoryReason, enumName: 'inventory_reason' })
  reason: InventoryReason;

  /** Set for SALE / ORDER_CANCELLED movements (foreign key added together with the orders table). */
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
