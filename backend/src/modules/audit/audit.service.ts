import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '@hardware-delivery/shared';
import { toPaginated } from '../../common/dto/pagination-query.dto';
import { RequestContext } from '../../common/request-context';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|authorization|card/i;
const MAX_DEPTH = 4;

/** Deep-clone to plain JSON, dropping sensitive keys and non-serialisable values. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) continue;
    if (typeof v === 'function') continue;
    out[k] = redact(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /**
   * Record an audit entry. The actor and network details come from the request context.
   * Failures are logged but never break the business operation that triggered them.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const ctx = RequestContext.get();
      await this.repo.save(
        this.repo.create({
          actorUserId: ctx?.userId ?? null,
          actorEmail: ctx?.userEmail ?? null,
          actorRoles: ctx?.roles?.join(',') ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (redact(entry.before) as Record<string, unknown>) ?? null,
          after: (redact(entry.after) as Record<string, unknown>) ?? null,
          metadata: (redact(entry.metadata) as Record<string, unknown>) ?? null,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
          requestId: ctx?.requestId ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${entry.action}: ${(err as Error).message}`);
    }
  }

  async list(query: AuditLogQueryDto): Promise<Paginated<AuditLog>> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (query.action) qb.andWhere('a.action ILIKE :action', { action: `${query.action}%` });
    if (query.entityType)
      qb.andWhere('a.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId) qb.andWhere('a.entityId = :entityId', { entityId: query.entityId });
    if (query.actorUserId)
      qb.andWhere('a.actorUserId = :actorUserId', { actorUserId: query.actorUserId });
    const [rows, total] = await qb.skip(query.offset).take(query.limit).getManyAndCount();
    return toPaginated(rows, total, query.page, query.limit);
  }
}
