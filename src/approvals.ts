import type { ApprovalStatus, PendingApproval } from '@weave-kit/contract';
import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** approval list filter — mirrors the engine `ApprovalListFilter` wire params */
export interface ApprovalListFilter {
  status?: ApprovalStatus;
  action?: string;
  actorKey?: string;
  requestedBy?: string;
  approvalKey?: string;
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
  comment?: string;
}

export interface ApprovalDecisionOptions {
  /** approver note (required for rejection by the Console contract) */
  comment?: string;
}

/** approval queue accessor: list / approve / reject over the engine REST surface */
export interface ApprovalsClient {
  list(params?: ApprovalListFilter): Promise<ApprovalListResult>;
  approve(approvalKey: string, options?: ApprovalDecisionOptions): Promise<ApprovalDecisionResult>;
  reject(approvalKey: string, options?: ApprovalDecisionOptions): Promise<ApprovalDecisionResult>;
}

export function createApprovalsClient(http: HttpOptions): ApprovalsClient {
  return {
    list(params?: ApprovalListFilter): Promise<ApprovalListResult> {
      const query: Record<string, string> = {};
      if (params?.status !== undefined) query.status = params.status;
      if (params?.action !== undefined) query.action = params.action;
      if (params?.actorKey !== undefined) query.actorKey = params.actorKey;
      if (params?.requestedBy !== undefined) query.requestedBy = params.requestedBy;
      if (params?.approvalKey !== undefined) query.approvalKey = params.approvalKey;
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
    approve(approvalKey: string, options?: ApprovalDecisionOptions): Promise<ApprovalDecisionResult> {
      return request<ApprovalDecisionResult>(http, 'POST', `/approvals/${encodeURIComponent(approvalKey)}/approve`, {
        ...(options?.comment === undefined ? {} : { body: { comment: options.comment } }),
      });
    },
    reject(approvalKey: string, options?: ApprovalDecisionOptions): Promise<ApprovalDecisionResult> {
      return request<ApprovalDecisionResult>(http, 'POST', `/approvals/${encodeURIComponent(approvalKey)}/reject`, {
        ...(options?.comment === undefined ? {} : { body: { comment: options.comment } }),
      });
    },
  };
}
