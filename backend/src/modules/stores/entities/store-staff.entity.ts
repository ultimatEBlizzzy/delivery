import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { StoreStaffRole } from '@hardware-delivery/shared';
import { BaseModel } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { HardwareStore } from './hardware-store.entity';

/** Links a user to a store with a role. A user can belong to several stores. */
@Entity('store_staff')
@Index('uq_store_staff_store_user', ['storeId', 'userId'], { unique: true })
@Index('idx_store_staff_user_id', ['userId'])
export class StoreStaff extends BaseModel {
  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne('HardwareStore', 'staff', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: HardwareStore;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: StoreStaffRole,
    enumName: 'store_staff_role',
    default: StoreStaffRole.STAFF,
  })
  role: StoreStaffRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
