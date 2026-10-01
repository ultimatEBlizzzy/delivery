import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      'Only for non-browser clients that send the header `x-auth-mode: token`. Browsers use the httpOnly cookie.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}
