import { Check, Column, DeleteDateColumn, Entity, Index, OneToMany } from 'typeorm';
import type { Point } from 'geojson';
import { OperatingHours, StoreStatus } from '@hardware-delivery/shared';
import { BaseModel } from '../../../database/base.entity';
import { decimalTransformer } from '../../../database/transformers';
import type { StoreStaff } from './store-staff.entity';

@Entity('hardware_stores')
@Check(
  'chk_hardware_stores_commission',
  `"commission_percent" IS NULL OR ("commission_percent" >= 0 AND "commission_percent" <= 50)`,
)
@Index('idx_hardware_stores_status', ['status', 'isActive'])
export class HardwareStore extends BaseModel {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 170, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255 })
  streetAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  suburb: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 50 })
  province: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postalCode: string | null;

  /** WGS84 point stored as PostGIS geography so ST_DWithin/ST_Distance work in metres. */
  @Index('idx_hardware_stores_location', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  @Column({ type: 'jsonb' })
  operatingHours: OperatingHours;

  @Column({
    type: 'enum',
    enum: StoreStatus,
    enumName: 'store_status',
    default: StoreStatus.PENDING,
  })
  status: StoreStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  /** Admin on/off switch (suspension). Inactive stores are invisible and cannot trade. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Store on/off switch ("we're too busy right now"). Visible but cannot receive new orders. */
  @Column({ type: 'boolean', default: true })
  acceptingOrders: boolean;

  /** Per-store override of the platform commission (%). NULL = use the platform default. */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  commissionPercent: number | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0, transformer: decimalTransformer })
  ratingAverage: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToMany('StoreStaff', 'store')
  staff: StoreStaff[];
}
