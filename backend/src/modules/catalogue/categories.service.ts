import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { CategoryDto } from '@hardware-delivery/shared';
import { slugify } from '../../common/utils/slug';
import { AuditService } from '../audit/audit.service';
import { StorageService, UploadedFile } from '../storage/storage.service';
import { toCategoryDto } from './catalogue.mapper';
import { CreateCategoryDto, UpdateCategoryDto } from './catalogue.dto';
import { Category } from './entities/category.entity';
import { VISIBLE_LISTING_SQL, VISIBLE_PRODUCT_SQL, VISIBLE_STORE_SQL } from './visibility';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The category tree. Public callers see only active categories (and nothing below an inactive
   * one) with the number of purchasable listings; admins can include inactive ones.
   */
  async tree(
    opts: { includeInactive?: boolean; withCounts?: boolean } = {},
  ): Promise<CategoryDto[]> {
    const all = await this.repo.find({
      where: opts.includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const counts =
      opts.withCounts === false ? new Map<string, number>() : await this.listingCounts();

    const nodes = new Map<string, CategoryDto>(
      all.map((c) => [c.id, { ...toCategoryDto(c, 0), children: [] }]),
    );
    const roots: CategoryDto[] = [];
    for (const c of all) {
      const node = nodes.get(c.id)!;
      const parent = c.parentId ? nodes.get(c.parentId) : null;
      if (!c.parentId) roots.push(node);
      else if (parent) parent.children!.push(node);
      // else: parent is inactive/deleted – this subtree is not reachable publicly
    }
    const roll = (node: CategoryDto): number => {
      const own = counts.get(node.id) ?? 0;
      node.listingCount = own + (node.children ?? []).reduce((sum, ch) => sum + roll(ch), 0);
      return node.listingCount;
    };
    roots.forEach(roll);
    return roots;
  }

  private async listingCounts(): Promise<Map<string, number>> {
    const rows = (await this.dataSource.query(
      `SELECT p.category_id AS id, COUNT(*)::int AS count
         FROM store_products sp
         JOIN products p ON p.id = sp.product_id AND ${VISIBLE_PRODUCT_SQL}
         JOIN hardware_stores s ON s.id = sp.store_id AND ${VISIBLE_STORE_SQL}
        WHERE ${VISIBLE_LISTING_SQL}
        GROUP BY p.category_id`,
    )) as Array<{ id: string; count: number }>;
    return new Map(rows.map((r) => [r.id, Number(r.count)]));
  }

  async getOrFail(id: string): Promise<Category> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  /** The category and every category below it (cycle-safe: UNION, not UNION ALL). */
  async descendantIds(id: string): Promise<string[]> {
    const rows = (await this.dataSource.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM categories WHERE id = $1 AND deleted_at IS NULL
         UNION
         SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id WHERE c.deleted_at IS NULL
       )
       SELECT id FROM tree`,
      [id],
    )) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  /** Root → … → category (for breadcrumbs). */
  async ancestors(id: string): Promise<Category[]> {
    const chain: Category[] = [];
    let current: Category | null = await this.repo.findOne({ where: { id } });
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      current = current.parentId
        ? await this.repo.findOne({ where: { id: current.parentId } })
        : null;
    }
    return chain;
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name) || 'category';
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? base : `${base}-${i}`;
      const existing = await this.repo.findOne({ where: { slug: candidate }, withDeleted: true });
      if (!existing || existing.id === excludeId) return candidate;
    }
  }

  private async assertValidParent(
    parentId: string | null | undefined,
    selfId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (parentId === selfId) throw new BadRequestException('A category cannot be its own parent');
    const parent = await this.repo.findOne({ where: { id: parentId } });
    if (!parent) throw new BadRequestException('Parent category not found');
    if (selfId && (await this.descendantIds(selfId)).includes(parentId)) {
      throw new BadRequestException(
        'A category cannot be moved under one of its own sub-categories',
      );
    }
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    await this.assertValidParent(dto.parentId);
    const category = await this.repo.save(
      this.repo.create({
        name: dto.name,
        parentId: dto.parentId ?? null,
        slug: await this.uniqueSlug(dto.name),
        description: dto.description ?? null,
        icon: dto.icon ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
    await this.audit.record({
      action: 'category.create',
      entityType: 'category',
      entityId: category.id,
      after: category,
    });
    return toCategoryDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const category = await this.getOrFail(id);
    const before = { ...category };
    if (dto.parentId !== undefined) {
      await this.assertValidParent(dto.parentId, id);
      category.parentId = dto.parentId;
    }
    if (dto.name !== undefined && dto.name !== category.name) {
      category.name = dto.name;
      category.slug = await this.uniqueSlug(dto.name, id);
    }
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.icon !== undefined) category.icon = dto.icon;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    const saved = await this.repo.save(category);
    await this.audit.record({
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      before,
      after: saved,
    });
    return toCategoryDto(saved);
  }

  async setImage(id: string, file: UploadedFile | undefined): Promise<CategoryDto> {
    const category = await this.getOrFail(id);
    const stored = await this.storage.saveImage(file, 'categories');
    const previous = category.imageUrl;
    category.imageUrl = stored.url;
    await this.repo.save(category);
    if (previous?.startsWith('/uploads/'))
      await this.storage.delete(previous.replace('/uploads/', ''), 'public');
    await this.audit.record({ action: 'category.image', entityType: 'category', entityId: id });
    return toCategoryDto(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.getOrFail(id);
    const children = await this.repo.count({ where: { parentId: id, deletedAt: IsNull() } });
    if (children > 0)
      throw new ConflictException(
        `This category has ${children} sub-categor${children === 1 ? 'y' : 'ies'}. Move or delete them first.`,
      );
    const [{ count }] = (await this.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1 AND deleted_at IS NULL',
      [id],
    )) as Array<{ count: number }>;
    if (count > 0) {
      throw new ConflictException(
        `${count} product${count === 1 ? ' is' : 's are'} in this category. Move them first, or deactivate the category instead.`,
      );
    }
    await this.repo.softRemove(category);
    await this.audit.record({
      action: 'category.delete',
      entityType: 'category',
      entityId: id,
      before: category,
    });
  }
}
