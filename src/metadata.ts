import type { MetadataPermissions, ObjectDescriptor } from '@weave-kit/engine';
import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** `GET /api/permissions` — per-object effective permissions for the identity */
export interface PermissionsResult {
  objects: Array<{ name: string; label: string; permissions: MetadataPermissions }>;
}

/** metadata + permissions accessors (M11 frontend contract) */
export interface MetadataClient {
  /** all objects the identity can read, each with its field schema + permissions */
  list(): Promise<{ objects: ObjectDescriptor[] }>;
  /** one object descriptor (404 unknown / 403 unreadable) */
  get(name: string): Promise<ObjectDescriptor>;
  /** effective permissions per object (Refine accessControl / RA canAccess source) */
  permissions(): Promise<PermissionsResult>;
}

export function createMetadataClient(http: HttpOptions): MetadataClient {
  return {
    list(): Promise<{ objects: ObjectDescriptor[] }> {
      return request<{ objects: ObjectDescriptor[] }>(http, 'GET', '/metadata');
    },
    get(name: string): Promise<ObjectDescriptor> {
      return request<ObjectDescriptor>(http, 'GET', '/metadata', { query: { object: name } });
    },
    permissions(): Promise<PermissionsResult> {
      return request<PermissionsResult>(http, 'GET', '/permissions');
    },
  };
}
