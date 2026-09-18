import type { ApprovalStatus, PendingApproval } from '@weave-kit/engine';
import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** approval list filter (D1) — mirrors the engine `ApprovalListFilter` wire params */
export interface ApprovalListFilter {
  status?: ApprovalStatus;
  action?: string;
  actorKey?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  sort?: { field: string; order: 'ASC' | 'DESC' };
}

/** `GET /api/approvals` — paged approval queue (admin read) */
export interface ApprovalListResult {
  rows: PendingApproval[];
  total: number;
  limit: number;
  offset: number;
}

/** resolution result (admin write) */
export interface ApprovalDecisionResult {
  approvalKey: string;
  status: ApprovalStatus;
  approver: string;
}

/** approval queue accessor (D1): list / approve / reject over the engine REST surface */
export interface ApprovalsClient {
  list(params?: ApprovalListFilter): Promise<ApprovalListResult>;
  approve(approvalKey: string): Promise<ApprovalDecisionResult>;
  reject(approvalKey: string): Promise<ApprovalDecisionResult>;
}

export function createApprovalsClient(http: HttpOptions): ApprovalsClient {
  return {
    list(params?: ApprovalListFilter): Promise<ApprovalListResult> {
      const query: Record<string, string> = {};
      if (params?.status !== undefined) query.status = params.status;
      if (params?.action !== undefined) query.action = params.action;
      if (params?.actorKey !== undefined) query.actorKey = params.actorKey;
      if (params?.from !== undefined) query.from = params.from.toISOString();
      if (params?.to !== undefined) query.to = params.to.toISOString();
      if (params?.limit !== undefined) query.limit = String(params.limit);
      if (params?.offset !== undefined) query.offset = String(params.offset);
      if (params?.sort !== undefined) {
        query.sort = params.sort.field;
        query.order = params.sort.order;
      }
      return request<ApprovalListResult>(http, 'GET', '/approvals', {
        query: Object.keys(query).length === 0 ? undefined : query,
      });
    },
    approve(approvalKey: string): Promise<ApprovalDecisionResult> {
      return request<ApprovalDecisionResult>(http, 'POST', `/approvals/${encodeURIComponent(approvalKey)}/approve`);
    },
    reject(approvalKey: string): Promise<ApprovalDecisionResult> {
      return request<ApprovalDecisionResult>(http, 'POST', `/approvals/${encodeURIComponent(approvalKey)}/reject`);
    },
  };
}
