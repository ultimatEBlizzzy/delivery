import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OperatingHours,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_REGEX,
  SA_PROVINCES,
  StoreStaffRole,
  StoreStatus,
} from '@hardware-delivery/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IsOperatingHours } from '../../common/validators/is-operating-hours';
import {
  IsSaPhone,
  ToBoolean,
  Trim,
  TrimLower,
} from '../../common/validators/transform.decorators';

export class StoreOwnerDto {
  @ApiProperty()
  @TrimLower()
  @IsEmail({}, { message: 'Enter a valid owner email address' })
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSaPhone()
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Initial password. Omit to have a strong temporary one generated and returned once.',
  })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_POLICY_MESSAGE })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password?: string;
}

export class CreateStoreDto {
  @ApiProperty({ example: 'Malamulele Hardware' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '015 123 4567' })
  @IsOptional()
  @IsSaPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimLower()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiProperty({ example: '12 Main Road' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  streetAddress: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  suburb?: string | null;

  @ApiProperty({ example: 'Malamulele' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ enum: SA_PROVINCES })
  @IsIn(SA_PROVINCES as readonly string[])
  province: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Postal code must be 4 digits' })
  postalCode?: string | null;

  @ApiProperty({ example: -23.0167 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 30.6781 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Weekly opening hours (mon..sun). Defaults to a standard trading week.',
  })
  @IsOptional()
  @IsOperatingHours()
  operatingHours?: OperatingHours;

  @ApiPropertyOptional({
    description: 'Overrides the platform commission (%) for this store; null = platform default',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  commissionPercent?: number | null;

  @ApiPropertyOptional({
    enum: StoreStatus,
    description: 'Defaults to APPROVED for stores created by an administrator',
  })
  @IsOptional()
  @IsIn(Object.values(StoreStatus))
  status?: StoreStatus;

  @ApiPropertyOptional({
    type: StoreOwnerDto,
    description: 'Creates (or links) the store owner account',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StoreOwnerDto)
  owner?: StoreOwnerDto;
}

export class UpdateStoreDto extends PartialType(
  OmitType(CreateStoreDto, ['owner', 'status'] as const),
) {}

export class SetStoreStatusDto {
  @ApiProperty({ enum: StoreStatus })
  @IsIn(Object.values(StoreStatus))
  status: StoreStatus;

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SetStoreActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}

/** What a store may change about itself (address/location changes go through an administrator). */
export class UpdateOwnStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSaPhone()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @TrimLower()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsOperatingHours()
  operatingHours?: OperatingHours;

  @ApiPropertyOptional({ description: 'Pause or resume new orders' })
  @IsOptional()
  @IsBoolean()
  acceptingOrders?: boolean;
}

export class AdminStoreQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: StoreStatus })
  @IsOptional()
  @IsIn(Object.values(StoreStatus))
  status?: StoreStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: SA_PROVINCES })
  @IsOptional()
  @IsIn(SA_PROVINCES as readonly string[])
  province?: string;
}

export class PublicStoreQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Only stores selling something in this category (incl. sub-categories)',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Only stores within this many km (needs lat/lng)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  radiusKm?: number;

  @ApiPropertyOptional({ enum: ['distance', 'name', 'rating'] })
  @IsOptional()
  @IsIn(['distance', 'name', 'rating'])
  sort?: 'distance' | 'name' | 'rating';
}

export class StoreDetailQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

// ---- staff ------------------------------------------------------------------------------------
export class AddStaffDto extends StoreOwnerDto {
  @ApiProperty({ enum: StoreStaffRole })
  @IsIn(Object.values(StoreStaffRole))
  role: StoreStaffRole;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ enum: StoreStaffRole })
  @IsOptional()
  @IsIn(Object.values(StoreStaffRole))
  role?: StoreStaffRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StaffQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Admin only: restrict to one store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Matches name or email' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}
