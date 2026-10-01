import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PRODUCT_UNITS } from '@hardware-delivery/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ToBoolean, Trim, TrimUpper } from '../../common/validators/transform.decorators';

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------
export class CreateCategoryDto {
  @ApiProperty({ example: 'Cement & Concrete' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Parent category id; omit for a top-level category' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'lucide icon name, e.g. "hammer"', example: 'hammer' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,50}$/, { message: 'Icon must be a lucide icon name such as "hammer"' })
  icon?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryQueryDto {
  @ApiPropertyOptional({ description: 'Admins only: include inactive categories' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Products (global catalogue)
// ---------------------------------------------------------------------------------------------
export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Cement 42.5R 50kg' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'CEM-425R-50', description: 'Unique across the whole catalogue' })
  @TrimUpper()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{1,59}$/, {
    message: 'SKU may contain letters, numbers, dots, dashes and underscores',
  })
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ enum: PRODUCT_UNITS })
  @IsIn(PRODUCT_UNITS as readonly string[])
  unit: string;

  @ApiPropertyOptional({ example: '50 kg bag' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  packSize?: string | null;

  @ApiProperty({
    description: 'Weight of ONE unit in kilograms – used to pick a vehicle',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(50_000)
  weightKg: number;

  @ApiPropertyOptional({ description: 'Longest dimension etc. in centimetres' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(2000)
  lengthCm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(2000)
  widthCm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(2000)
  heightCm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class AdminProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, SKU or brand' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class CatalogueSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

// ---------------------------------------------------------------------------------------------
// Store listings (store-specific price & stock)
// ---------------------------------------------------------------------------------------------
class ListingFieldsDto {
  @ApiPropertyOptional({ description: "The store's own SKU" })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  storeSku?: string | null;

  @ApiPropertyOptional({ description: 'Sale price; must be lower than price. null clears it.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  salePrice?: number | null;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  minimumQuantity?: number;

  @ApiPropertyOptional({ description: 'null = no maximum' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maximumQuantity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;
}

export class CreateListingDto extends ListingFieldsDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 109.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  price: number;

  @ApiPropertyOptional({ description: 'Opening stock (recorded in the inventory ledger)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQuantity?: number;
}

export class UpdateListingDto extends ListingFieldsDto {
  @ApiPropertyOptional({ example: 109.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10_000_000)
  price?: number;
}

export class AdminCreateListingDto extends CreateListingDto {
  @ApiProperty()
  @IsUUID()
  storeId: string;
}

export class ListingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Admin only: restrict to one store' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ enum: ['low', 'out', 'in'] })
  @IsOptional()
  @IsIn(['low', 'out', 'in'])
  stock?: 'low' | 'out' | 'in';
}

// ---------------------------------------------------------------------------------------------
// Public browsing
// ---------------------------------------------------------------------------------------------
export class PublicListingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Words are matched against name, brand, SKU and category' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Includes all sub-categories' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Only offers that can be ordered right now' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    description: 'Customer latitude (enables distance sorting and filtering)',
  })
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

  @ApiPropertyOptional({ enum: ['relevance', 'price_asc', 'price_desc', 'distance', 'name'] })
  @IsOptional()
  @IsIn(['relevance', 'price_asc', 'price_desc', 'distance', 'name'])
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'distance' | 'name';
}

export class ProductDetailQueryDto {
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
