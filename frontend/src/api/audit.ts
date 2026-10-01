import type { Paginated } from '@hardware-delivery/shared';
import { http } from '@/lib/http';

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRoles: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditQuery {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
}

export const auditApi = {
  list: (query: AuditQuery) =>
    http.get<Paginated<AuditLogDto>>('/admin/audit-logs', { query: { ...query } }),
};
