import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validators/transform.decorators';

export class GeocodeDto {
  @ApiProperty({ example: '12 Main Road, Malamulele, Limpopo' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Enter an address to look up' })
  @MaxLength(300)
  address: string;
}
