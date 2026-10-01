import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseModel } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/** Customer profile. One row per user holding the CUSTOMER role. */
@Entity('customers')
export class Customer extends BaseModel {
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'boolean', default: false })
  marketingOptIn: boolean;
}
