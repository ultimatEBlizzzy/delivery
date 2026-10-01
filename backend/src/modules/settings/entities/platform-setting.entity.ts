import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Key/value platform configuration (fees, commissions, dispatch rules…). See shared SETTING_DEFINITIONS. */
@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
