import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { InventoryReason } from '@hardware-delivery/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Trim } from '../../../common/validators/transform.decorators';

/** Reasons a person may record. SALE / ORDER_CANCELLED / INITIAL_STOCK are written by the system only. */
export const MANUAL_REASONS = [
  InventoryReason.RESTOCK,
  InventoryReason.ADJUSTMENT,
  InventoryReason.CORRECTION,
] as const;

export class AdjustStockDto {
  @ApiProperty({
    enum: ['ADD', 'REMOVE', 'SET'],
    description: 'ADD/REMOVE change stock by `quantity`; SET replaces the level.',
  })
  @IsIn(['ADD', 'REMOVE', 'SET'])
  mode: 'ADD' | 'REMOVE' | 'SET';

  @ApiProperty({ minimum: 0, maximum: 1_000_000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  quantity: number;

  @ApiProperty({ enum: MANUAL_REASONS })
  @IsIn(MANUAL_REASONS)
  reason: InventoryReason;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class MovementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeProductId?: string;

  @ApiPropertyOptional({ description: 'Admin only: restrict to one store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ enum: InventoryReason })
  @IsOptional()
  @IsIn(Object.values(InventoryReason))
  reason?: InventoryReason;
}
