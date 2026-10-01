import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImageDto } from '@hardware-delivery/shared';
import { AuditService } from '../audit/audit.service';
import { StorageService, UploadedFile } from '../storage/storage.service';
import { toImageDto } from './catalogue.mapper';
import { ProductImage } from './entities/product-image.entity';

const MAX_IMAGES_PER_PRODUCT = 8;

@Injectable()
export class ProductImagesService {
  constructor(
    @InjectRepository(ProductImage) private readonly images: Repository<ProductImage>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async add(
    productId: string,
    file: UploadedFile | undefined,
    alt?: string,
  ): Promise<ProductImageDto> {
    const existing = await this.images.find({ where: { productId }, order: { sortOrder: 'ASC' } });
    if (existing.length >= MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
    }
    const stored = await this.storage.saveImage(file, 'products');
    const image = await this.images.save(
      this.images.create({
        productId,
        url: stored.url,
        storageKey: stored.key,
        alt: alt?.trim() || null,
        sortOrder: existing.length ? Math.max(...existing.map((i) => i.sortOrder)) + 1 : 0,
        isPrimary: existing.length === 0,
      }),
    );
    await this.audit.record({
      action: 'product.image.add',
      entityType: 'product',
      entityId: productId,
      after: { imageId: image.id },
    });
    return toImageDto(image);
  }

  async setPrimary(productId: string, imageId: string): Promise<ProductImageDto[]> {
    const images = await this.images.find({ where: { productId } });
    if (!images.some((i) => i.id === imageId)) throw new NotFoundException('Image not found');
    await this.images.manager.transaction(async (m) => {
      await m.update(ProductImage, { productId }, { isPrimary: false });
      await m.update(ProductImage, { id: imageId }, { isPrimary: true });
    });
    const updated = await this.images.find({ where: { productId }, order: { sortOrder: 'ASC' } });
    return updated.map(toImageDto);
  }

  async remove(productId: string, imageId: string): Promise<void> {
    const image = await this.images.findOne({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Image not found');
    await this.images.remove(image);
    await this.storage.delete(image.storageKey, 'public');
    if (image.isPrimary) {
      const next = await this.images.findOne({ where: { productId }, order: { sortOrder: 'ASC' } });
      if (next) await this.images.update({ id: next.id }, { isPrimary: true });
    }
    await this.audit.record({
      action: 'product.image.remove',
      entityType: 'product',
      entityId: productId,
      before: { imageId },
    });
  }
}
