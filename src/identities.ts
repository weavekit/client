import type { HttpOptions } from './http.js';
import { request } from './http.js';

export interface IdentitySummary {
  ref: string;
  id: string;
  roles: string[];
  teamId?: string;
}

export interface IdentitiesListResult {
  identities: IdentitySummary[];
}

export interface IdentitiesClient {
  /** list the engine's MCP on-behalf-of identity directory (admin read) */
  list(): Promise<IdentitiesListResult>;
}

export function createIdentitiesClient(http: HttpOptions): IdentitiesClient {
  return {
    list(): Promise<IdentitiesListResult> {
      return request<IdentitiesListResult>(http, 'GET', '/identities');
    },
  };
}
