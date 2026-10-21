import type { ApprovalStatus, ApprovalVote, PendingApproval } from '@weave-kit/contract';
import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** approval list filter — mirrors the engine `ApprovalListFilter` wire params */
export interface ApprovalListFilter {
  status?: ApprovalStatus;
  action?: string;
  actorKey?: string;
  requestedBy?: string;
  approvalKey?: string;
  /** free-text search across action / actor / requester / approval key */
  q?: string;
  pendingFor?: string;
  expiresBefore?: Date;
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
  approvedCount?: number;
  requiredApprovals?: number;
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
  vote(
    approvalKey: string,
    vote: Omit<ApprovalVote, 'approvalKey' | 'createdAt'>,
  ): Promise<ApprovalDecisionResult>;
  votes(approvalKey: string): Promise<{ approvalKey: string; votes: ApprovalVote[] }>;
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
      if (params?.q !== undefined) query.q = params.q;
      if (params?.pendingFor !== undefined) query.pendingFor = params.pendingFor;
      if (params?.expiresBefore !== undefined) query.expiresBefore = params.expiresBefore.toISOString();
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
    vote(approvalKey, vote): Promise<ApprovalDecisionResult> {
      return request<ApprovalDecisionResult>(http, 'POST', `/approvals/${encodeURIComponent(approvalKey)}/decisions`, {
        body: { decision: vote.decision, ...(vote.comment === undefined ? {} : { comment: vote.comment }) },
      });
    },
    votes(approvalKey): Promise<{ approvalKey: string; votes: ApprovalVote[] }> {
      return request<{ approvalKey: string; votes: ApprovalVote[] }>(
        http,
        'GET',
        `/approvals/${encodeURIComponent(approvalKey)}/votes`,
      );
    },
  };
}
