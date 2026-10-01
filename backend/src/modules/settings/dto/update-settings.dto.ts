import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Map of setting key to new value, e.g. { "fees.serviceFeePercent": 4 }',
    example: { 'fees.serviceFeePercent': 4 },
  })
  @IsObject()
  settings: Record<string, unknown>;
}
