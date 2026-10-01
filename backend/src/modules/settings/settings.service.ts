import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  getSettingDefinition,
  SETTING_DEFAULTS,
  SETTING_DEFINITIONS,
  SettingDto,
  SettingKey,
  validateSettingValue,
} from '@hardware-delivery/shared';
import { RequestContext } from '../../common/request-context';
import { AuditService } from '../audit/audit.service';
import { PlatformSetting } from './entities/platform-setting.entity';

const CACHE_TTL_MS = 10_000;

/**
 * Reads and writes platform configuration. Values live in the database (admin-editable); anything
 * not yet stored falls back to the defaults in the shared settings schema. A short in-memory cache
 * keeps hot paths (pricing, dispatch) off the database; it is invalidated on every local write.
 */
@Injectable()
export class SettingsService {
  private cache: Map<string, { value: unknown; updatedAt: Date | null }> | null = null;
  private cacheLoadedAt = 0;

  constructor(
    @InjectRepository(PlatformSetting) private readonly repo: Repository<PlatformSetting>,
    private readonly audit: AuditService,
  ) {}

  private async load(): Promise<Map<string, { value: unknown; updatedAt: Date | null }>> {
    if (this.cache && Date.now() - this.cacheLoadedAt < CACHE_TTL_MS) return this.cache;
    const rows = await this.repo.find();
    this.cache = new Map(rows.map((r) => [r.key, { value: r.value, updatedAt: r.updatedAt }]));
    this.cacheLoadedAt = Date.now();
    return this.cache;
  }

  invalidate(): void {
    this.cache = null;
  }

  async get<T = unknown>(key: SettingKey): Promise<T> {
    const stored = (await this.load()).get(key);
    return (stored ? stored.value : SETTING_DEFAULTS[key]) as T;
  }

  async getNumber(key: SettingKey): Promise<number> {
    return Number(await this.get(key));
  }

  async getBoolean(key: SettingKey): Promise<boolean> {
    return Boolean(await this.get(key));
  }

  async getAll(): Promise<SettingDto[]> {
    const stored = await this.load();
    return SETTING_DEFINITIONS.map((def) => {
      const row = stored.get(def.key);
      const dto: SettingDto = {
        key: def.key,
        group: def.group,
        label: def.label,
        description: def.description,
        type: def.type,
        value: row ? row.value : def.defaultValue,
        defaultValue: def.defaultValue,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
      if ('min' in def) dto.min = def.min;
      if ('max' in def) dto.max = def.max;
      if ('unit' in def) dto.unit = def.unit;
      return dto;
    });
  }

  async getPublic(): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const def of SETTING_DEFINITIONS) {
      if ('public' in def && def.public) out[def.key] = await this.get(def.key);
    }
    return out;
  }

  /** Validates every entry against the shared schema, then writes them atomically. */
  async updateMany(values: Record<string, unknown>): Promise<SettingDto[]> {
    const entries = Object.entries(values);
    if (entries.length === 0) throw new BadRequestException('No settings provided');

    const errors: string[] = [];
    for (const [key, value] of entries) {
      const def = getSettingDefinition(key);
      if (!def) {
        errors.push(`Unknown setting "${key}"`);
        continue;
      }
      const problem = validateSettingValue(def, value);
      if (problem) errors.push(problem);
    }
    if (errors.length) {
      throw new BadRequestException({
        message: errors.join('; '),
        details: errors.map((messages) => ({ messages: [messages] })),
      });
    }
    // Cross-field rule: the minimum service fee cannot exceed the maximum.
    const current = async (k: SettingKey) =>
      (k in values ? values[k] : await this.get(k)) as number;
    if ((await current('fees.serviceFeeMin')) > (await current('fees.serviceFeeMax'))) {
      throw new BadRequestException(
        'Minimum service fee cannot be higher than the maximum service fee',
      );
    }

    const before: Record<string, unknown> = {};
    for (const [key] of entries) before[key] = await this.get(key as SettingKey);
    const userId = RequestContext.get()?.userId ?? null;

    await this.repo.manager.transaction(async (manager) => {
      for (const [key, value] of entries) {
        await manager.upsert(PlatformSetting, { key, value: value as never, updatedBy: userId }, [
          'key',
        ]);
      }
    });
    this.invalidate();

    await this.audit.record({
      action: 'settings.update',
      entityType: 'platform_settings',
      before,
      after: values,
    });
    return this.getAll();
  }
}
