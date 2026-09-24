import type { HttpOptions } from './http.js';
import { ClientError, request } from './http.js';

export interface GuardrailPolicySummary {
  name: string;
  version: string;
}

export interface GuardrailPolicySource {
  source: string;
  version: string;
}

export interface GuardrailPolicyCommit {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
  /** source blob at this commit; null when unavailable */
  source: string | null;
  version: string | null;
}

export interface GuardrailPolicyHistory {
  name: string;
  commits: GuardrailPolicyCommit[];
}

export interface GuardrailSourceOptions {
  signal?: AbortSignal;
}

export interface GuardrailSaveOptions extends GuardrailSourceOptions {
  /** reserved for optimistic locking; the engine accepts but does not enforce it */
  expectVersion?: string;
}

export interface GuardrailListResult {
  policies: GuardrailPolicySummary[];
}

export interface GuardrailSaveResult {
  ok: true;
  committed: boolean;
  version: string;
}

/**
 * Guardrail policy source accessor: the engine project's `policies/`
 * directory (admin) — list policy files, read one policy's source, and write it
 * back (git committed). Inline-array guardrails have no file surface so `list`
 * returns `{ policies: [] }` when the project configures none.
 */
export interface GuardrailsClient {
  /** list guardrail policy files (name + source version) */
  list(options?: GuardrailSourceOptions): Promise<GuardrailListResult>;
  /** read one policy source (404 → null) */
  getSource(name: string, options?: GuardrailSourceOptions): Promise<GuardrailPolicySource | null>;
  /** git history of one policy file (commits that touched it + source blob each) */
  history(name: string, options?: GuardrailSourceOptions): Promise<GuardrailPolicyHistory>;
  /** write/replace a policy source and commit it to the engine project's Git repo */
  save(name: string, source: string, options?: GuardrailSaveOptions): Promise<GuardrailSaveResult>;
}

export function createGuardrailsClient(http: HttpOptions): GuardrailsClient {
  return {
    list(options = {}) {
      return request<GuardrailListResult>(http, 'GET', '/guardrails/policies', { signal: options.signal });
    },
    async getSource(name: string, options = {}) {
      try {
        return await request<GuardrailPolicySource>(
          http,
          'GET',
          `/guardrails/policies/${encodeURIComponent(name)}`,
          { signal: options.signal },
        );
      } catch (error) {
        if (error instanceof ClientError && error.status === 404) return null;
        throw error;
      }
    },
    history(name: string, options = {}) {
      return request<GuardrailPolicyHistory>(
        http,
        'GET',
        `/guardrails/policies/${encodeURIComponent(name)}/history`,
        { signal: options.signal },
      );
    },
    save(name: string, source: string, options = {}) {
      return request<GuardrailSaveResult>(
        http,
        'PUT',
        `/guardrails/policies/${encodeURIComponent(name)}`,
        {
          body: options.expectVersion === undefined ? { source } : { source, expectVersion: options.expectVersion },
          signal: options.signal,
        },
      );
    },
  };
}
