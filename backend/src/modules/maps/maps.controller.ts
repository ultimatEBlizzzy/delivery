import { Body, Controller, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GeocodeResultDto } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { GeocodeDto } from './dto/geocode.dto';
import { MapsService } from './maps.service';

@ApiTags('Maps')
@Auth()
@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  @Post('geocode')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn an address into coordinates (uses the configured maps provider)' })
  async geocode(@Body() dto: GeocodeDto): Promise<GeocodeResultDto> {
    const result = await this.maps.geocodeAddress(dto.address);
    if (!result) {
      throw new NotFoundException(
        'We could not find that address. Try adding the town or drop a pin on the map.',
      );
    }
    return {
      latitude: result.lat,
      longitude: result.lng,
      formattedAddress: result.formattedAddress,
      confidence: result.confidence,
      suburb: result.suburb,
      city: result.city,
      province: result.province,
    };
  }
}
