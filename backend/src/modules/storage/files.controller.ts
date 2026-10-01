import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CONTENT_TYPE_BY_EXT } from './file-type';
import { StorageService } from './storage.service';

/**
 * Serves PRIVATE files (driver documents, delivery photos) to holders of a valid signed URL.
 * Signed URLs are produced only for users the API has already authorised to see the file.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('private/:folder/:name')
  async getPrivate(
    @Param('folder') folder: string,
    @Param('name') name: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `${folder}/${name}`;
    if (!this.storage.verifySignature(key, Number(exp), sig)) {
      throw new ForbiddenException('This link is invalid or has expired');
    }
    const file = await this.storage.open(key, 'private');
    if (!file) throw new NotFoundException('File not found');
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    res.setHeader('Content-Type', CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
    file.stream.pipe(res);
  }
}
