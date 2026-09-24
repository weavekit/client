import type { HttpOptions } from './http.js';
import { ClientError, request } from './http.js';

/**
 * Raw object schema source accessor. The engine serves/accepts
 * `objects/<name>/schema.json` source + content version (admin-gated). PUT runs
 * the loader's validation (parse + full cross-object graph) and never applies
 * DDL — structural changes take effect on the next `weave dev`/`migrate`.
 */

export interface SchemaSourceDocument {
  source: string;
  version: string;
}

export interface SchemaSourceOptions {
  signal?: AbortSignal;
}

export interface SchemaSaveOptions extends SchemaSourceOptions {
  /** optimistic lock — 409 when the current version differs */
  expectVersion?: string;
  /** explicit overwrite: skip the version check */
  force?: boolean;
}

export interface SchemaSaveResult {
  ok: true;
  committed: boolean;
  version: string;
}

export interface SchemaClient {
  /** raw schema source + version for an object, or null (404) */
  getSource(name: string, options?: SchemaSourceOptions): Promise<SchemaSourceDocument | null>;
  /** replace an object's schema source (admin; strict optimistic lock unless `force`) */
  save(name: string, source: string, options?: SchemaSaveOptions): Promise<SchemaSaveResult>;
}

export function createSchemaClient(http: HttpOptions): SchemaClient {
  return {
    async getSource(name, options = {}) {
      try {
        return await request<SchemaSourceDocument>(
          http,
          'GET',
          `/objects/${encodeURIComponent(name)}/schema`,
          { signal: options.signal },
        );
      } catch (error) {
        if (error instanceof ClientError && error.status === 404) return null;
        throw error;
      }
    },
    save(name, source, options = {}) {
      const body: Record<string, unknown> = { source };
      if (options.expectVersion !== undefined) body.expectVersion = options.expectVersion;
      if (options.force !== undefined) body.force = options.force;
      return request<SchemaSaveResult>(
        http,
        'PUT',
        `/objects/${encodeURIComponent(name)}/schema`,
        { body, signal: options.signal },
      );
    },
  };
}
