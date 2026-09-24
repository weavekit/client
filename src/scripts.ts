import type { ScriptSourceKind } from "@weave-kit/engine";
import type { HttpOptions } from "./http.js";
import { ClientError, request } from "./http.js";

export interface ScriptSourceDocument {
  source: string;
  version: string;
}

export interface ScriptSourceOptions {
  signal?: AbortSignal;
}

export interface ScriptSaveOptions extends ScriptSourceOptions {
  /** Reserved for optimistic locking; servers accept but do not enforce it. */
  expectVersion?: string;
}

export interface ScriptSaveResult {
  ok: true;
  committed: boolean;
  version: string;
  warnings?: string[];
}

/** Page-scoped client script accessor (per-page customization): `show.client`/`list.client`.
 *  Page-level (`/pages/<path>/scripts/<kind>`) overrides the object script for
 *  that page; block-level (`/pages/<path>/blocks/<ui_id>/scripts/<kind>`) scopes
 *  a script to one `list` block instance. */
export interface PageScriptsClient {
  /** read a page-level or block-level client script (404 → null) */
  getSource(path: string, kind: string, options?: ScriptSourceOptions): Promise<ScriptSourceDocument | null>;
  /** write/replace a page-scoped client script (admin) */
  save(path: string, kind: string, source: string, options?: ScriptSaveOptions): Promise<ScriptSaveResult>;
  /** delete a page-scoped client script → falls back to the object script (admin) */
  delete(path: string, kind: string, options?: ScriptSourceOptions): Promise<{ ok: true; deleted: boolean }>;
}

export interface ScriptsClient {
  /** source for server/show/list scripts, including its content version */
  getSource(name: string, kind: ScriptSourceKind, options?: ScriptSourceOptions): Promise<ScriptSourceDocument | null>;
  /** replace one script source and commit it to the engine project's Git repository */
  save(name: string, kind: ScriptSourceKind, source: string, options?: ScriptSaveOptions): Promise<ScriptSaveResult>;
  /** page-scoped client scripts (`/pages/<path>/...`) */
  page: PageScriptsClient;
}

/** build a `/pages/<path>/<scope>/scripts/<kind>` URL fragment for a page-scoped script */
function pageScriptUrl(path: string, kind: string): string {
  return `/pages/${path}/scripts/${encodeURIComponent(kind)}`;
}

export function createScriptsClient(http: HttpOptions): ScriptsClient {
  return {
    getSource: async (name, kind, options = {}) => {
      try {
        return await request<ScriptSourceDocument>(
          http,
          "GET",
          `/objects/${encodeURIComponent(name)}/scripts/${encodeURIComponent(kind)}`,
          { signal: options.signal },
        );
      } catch (error) {
        if (error instanceof ClientError && error.status === 404) return null;
        throw error;
      }
    },
    save: (name, kind, source, options = {}) =>
      request<ScriptSaveResult>(
        http,
        "PUT",
        `/objects/${encodeURIComponent(name)}/scripts/${encodeURIComponent(kind)}`,
        {
          body: options.expectVersion === undefined ? { source } : { source, expectVersion: options.expectVersion },
          signal: options.signal,
        },
      ),
    page: {
      getSource: async (path, kind, options = {}) => {
        try {
          return await request<ScriptSourceDocument>(http, "GET", pageScriptUrl(path, kind), { signal: options.signal });
        } catch (error) {
          if (error instanceof ClientError && error.status === 404) return null;
          throw error;
        }
      },
      save: (path, kind, source, options = {}) =>
        request<ScriptSaveResult>(http, "PUT", pageScriptUrl(path, kind), {
          body: options.expectVersion === undefined ? { source } : { source, expectVersion: options.expectVersion },
          signal: options.signal,
        }),
      delete: async (path, kind, options = {}) =>
        request<{ ok: true; deleted: boolean }>(http, "DELETE", pageScriptUrl(path, kind), { signal: options.signal }),
    },
  };
}
