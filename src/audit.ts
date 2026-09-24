import type { AuditEvent, AuditQuery } from '@weave-kit/engine';
import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** `GET /api/audit` — paginated trail (own actor by default; adminRoles for the full view) */
export interface AuditResult {
  rows: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

/** audit accessor: paginated query with actor/action/object/date filters */
export interface AuditClient {
  query(params?: AuditQuery): Promise<AuditResult>;
}

export function createAuditClient(http: HttpOptions): AuditClient {
  return {
    query(params?: AuditQuery): Promise<AuditResult> {
      const query: Record<string, string> = {};
      if (params?.actorId !== undefined) query.actorId = params.actorId;
      if (params?.action !== undefined) query.action = params.action;
      if (params?.object !== undefined) query.object = params.object;
      if (params?.from !== undefined) query.from = params.from.toISOString();
      if (params?.to !== undefined) query.to = params.to.toISOString();
      if (params?.filter !== undefined) query.filter = JSON.stringify(params.filter);
      if (params?.limit !== undefined) query.limit = String(params.limit);
      if (params?.offset !== undefined) query.offset = String(params.offset);
      return request<AuditResult>(http, 'GET', '/audit', { query: Object.keys(query).length === 0 ? undefined : query });
    },
  };
}
