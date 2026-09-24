import type { LayoutAddress, ObjectLayoutView } from '@weave-kit/engine/layout';
import type { HttpOptions } from './http.js';
import { ClientError, request } from './http.js';

/**
 * Page layout source accessor. The engine serves the raw layout JSON
 * source and its content version via the path-mirrored API
 * (`/pages/<path>` — e.g. `app.layout` / `<id>.layout` /
 * `<object>/show.layout` / `<object>/list.layout`); interpretation belongs to
 * the frontend (@weave-kit/ui layout engine). GET is Bearer-authenticated;
 * PUT / page lifecycle are admin-gated server-side (403 when the identity's
 * roles miss `rest.adminRoles`). 404 → null; stale `expectVersion` → 409.
 */

export interface SourceDocument {
  source: string;
  version: string;
}

export interface LayoutSourceOptions {
  signal?: AbortSignal;
}

export interface LayoutSaveOptions extends LayoutSourceOptions {
  /** optimistic lock — 409 when the current version differs */
  expectVersion?: string;
  /** explicit overwrite: skip the version check */
  force?: boolean;
}

export interface LayoutSaveResult {
  ok: true;
  committed: boolean;
  version: string;
}

export type PageSummary =
  | { kind: 'shell'; id: 'app'; path: string }
  | { kind: 'object'; id: string; view: ObjectLayoutView; path: string }
  | { kind: 'custom'; id: string; path: string };

export interface CreatePageOptions {
  /** optional initial layout source (defaults to an empty desktop layout) */
  source?: string;
  signal?: AbortSignal;
}

export interface CreatePageResult {
  ok: true;
  id: string;
  path: string;
}

export interface RenamePageOptions {
  signal?: AbortSignal;
}

export interface RenamePageResult {
  ok: true;
  id: string;
  path: string;
}

export interface DeletePageOptions {
  signal?: AbortSignal;
}

export interface DeletePageResult {
  ok: true;
  deleted: boolean;
}

export interface DesignSavePart {
  source: string;
  expectVersion?: string;
}

export interface DesignSaveOptions {
  force?: boolean;
  signal?: AbortSignal;
}

export interface DesignSaveResult {
  ok: true;
  committed: boolean;
}

/** the `/pages/<path>` segment mirroring the physical file (single source lives in the engine) */
export function layoutPagePath(addr: LayoutAddress): string {
  switch (addr.kind) {
    case 'shell':
      return 'app.layout';
    case 'custom':
      return `${addr.id}/layout`;
    case 'object':
      return `${addr.id}/${addr.view}.layout`;
    case 'page-face':
      return `${addr.page}/objects/${addr.object}/${addr.face}.layout`;
  }
}

export interface LayoutsClient {
  /** layout source + content version for a page, or null (404) */
  getSource(addr: LayoutAddress, options?: LayoutSourceOptions): Promise<SourceDocument | null>;
  /** replace a page layout source (admin; strict optimistic lock unless `force`) */
  save(addr: LayoutAddress, source: string, options?: LayoutSaveOptions): Promise<LayoutSaveResult>;
  /** page catalog: shell + object show/list + custom pages */
  list(options?: { signal?: AbortSignal }): Promise<PageSummary[]>;
  /** create a custom page (admin) */
  create(id: string, options?: CreatePageOptions): Promise<CreatePageResult>;
  /** rename a custom page (admin; atomically updates shell PageRefs) */
  rename(id: string, newId: string, options?: RenamePageOptions): Promise<RenamePageResult>;
  /** delete a custom page (admin; 409 while referenced from the shell) */
  delete(id: string, options?: DeletePageOptions): Promise<DeletePageResult>;
  /** atomic object design save: show + list + owning schema in one Git commit (admin) */
  saveDesign(options: { object: string; show?: DesignSavePart; list?: DesignSavePart; schema?: DesignSavePart } & DesignSaveOptions): Promise<DesignSaveResult>;
}

export function createLayoutsClient(http: HttpOptions): LayoutsClient {
  const pagePath = (addr: LayoutAddress): string => `/pages/${layoutPagePath(addr)}`;

  return {
    async getSource(addr, options = {}) {
      try {
        return await request<SourceDocument>(http, 'GET', pagePath(addr), { signal: options.signal });
      } catch (error) {
        if (error instanceof ClientError && error.status === 404) return null;
        throw error;
      }
    },
    save(addr, source, options = {}) {
      const body: Record<string, unknown> = { source };
      if (options.expectVersion !== undefined) body.expectVersion = options.expectVersion;
      if (options.force !== undefined) body.force = options.force;
      return request<LayoutSaveResult>(http, 'PUT', pagePath(addr), { body, signal: options.signal });
    },
    list(options = {}) {
      return request<PageSummary[]>(http, 'GET', '/pages', { signal: options.signal });
    },
    create(id, options = {}) {
      const body: Record<string, unknown> = { id };
      if (options.source !== undefined) body.source = options.source;
      return request<CreatePageResult>(http, 'POST', '/pages', { body, signal: options.signal });
    },
    rename(id, newId, options = {}) {
      return request<RenamePageResult>(http, 'PATCH', `/pages/${encodeURIComponent(id)}`, { body: { newId }, signal: options.signal });
    },
    delete(id, options = {}) {
      return request<DeletePageResult>(http, 'DELETE', `/pages/${encodeURIComponent(id)}`, { signal: options.signal });
    },
    saveDesign({ object, show, list, schema, force, signal }) {
      const body: Record<string, unknown> = {};
      if (show !== undefined) body.show = show;
      if (list !== undefined) body.list = list;
      if (schema !== undefined) body.schema = schema;
      if (force !== undefined) body.force = force;
      return request<DesignSaveResult>(http, 'PUT', `/pages/${encodeURIComponent(object)}/design`, { body, signal });
    },
  };
}
