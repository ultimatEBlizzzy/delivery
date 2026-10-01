import { Check, Column, DeleteDateColumn, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { BaseModel } from '../../../database/base.entity';
import { RoleEntity } from './role.entity';

@Entity('users')
@Check('chk_users_email_lowercase', `"email" = lower("email")`)
export class User extends BaseModel {
  /** Always stored lower-cased (enforced by a CHECK constraint) so a plain unique index is case-insensitive. */
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** Argon2id hash. `select: false` keeps it out of every query unless explicitly requested. */
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Index('idx_users_phone')
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @ManyToMany(() => RoleEntity)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: RoleEntity[];

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
