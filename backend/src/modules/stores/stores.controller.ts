import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogueBrowseService } from '../catalogue/catalogue-browse.service';
import { PublicListingQueryDto } from '../catalogue/catalogue.dto';
import { PublicStoreQueryDto, StoreDetailQueryDto } from './stores.dto';
import { StoresService } from './stores.service';

@ApiTags('Stores (public)')
@Public()
@Controller('stores')
export class StoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly browse: CatalogueBrowseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Approved stores, nearest first when lat/lng are supplied' })
  list(@Query() query: PublicStoreQueryDto) {
    return this.stores.listPublic(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Store profile with the categories it sells in' })
  get(@Param('idOrSlug') idOrSlug: string, @Query() query: StoreDetailQueryDto) {
    return this.stores.getPublic(idOrSlug, query);
  }

  @Get(':idOrSlug/products')
  @ApiOperation({ summary: "A store's offers (prices and stock are specific to this store)" })
  async products(@Param('idOrSlug') idOrSlug: string, @Query() query: PublicListingQueryDto) {
    const store = await this.stores.getPublic(idOrSlug);
    return this.browse.searchListings({ ...query, storeId: store.id } as PublicListingQueryDto);
  }
}
