import type { RestResult } from '@weave-kit/engine';
import { ClientError, request } from './http.js';
import type { HttpOptions } from './http.js';
import { buildFindQuery } from './types.js';
import type { FindOneParams, FindParams } from './types.js';

/** typed CRUD handle for one object collection, parameterized by its generated type */
export interface ObjectsClient<T = Record<string, unknown>> {
  find(params?: FindParams, signal?: AbortSignal): Promise<RestResult<T>>;
  findOne(id: string, params?: FindOneParams, signal?: AbortSignal): Promise<T | null>;
  create(data: Partial<T>, signal?: AbortSignal): Promise<T>;
  update(id: string, changes: Partial<T>, signal?: AbortSignal): Promise<T>;
  delete(id: string, signal?: AbortSignal): Promise<void>;
  /** atomic batch update (single transaction): every id updated or none */
  updateMany(ids: string[], changes: Partial<T>, signal?: AbortSignal): Promise<{ updated: string[] }>;
  /** atomic batch delete (single transaction): every id deleted or none */
  deleteMany(ids: string[], signal?: AbortSignal): Promise<{ deleted: string[] }>;
}

export function createObjectsClient<T = Record<string, unknown>>(
  http: HttpOptions,
  name: string,
): ObjectsClient<T> {
  const path = `/objects/${encodeURIComponent(name)}`;

  return {
    find(params?: FindParams, signal?: AbortSignal): Promise<RestResult<T>> {
      return request(http, 'GET', path, {
        query: params === undefined ? undefined : buildFindQuery(params),
        signal,
      });
    },

    async findOne(id: string, params?: FindOneParams, signal?: AbortSignal): Promise<T | null> {
      const query = params?.fields === undefined ? undefined : { fields: params.fields.join(',') };
      try {
        return await request<T>(http, 'GET', `${path}/${encodeURIComponent(id)}`, { query, signal });
      } catch (error) {
        if (error instanceof ClientError && error.status === 404) return null;
        throw error;
      }
    },

    create(data: Partial<T>, signal?: AbortSignal): Promise<T> {
      return request(http, 'POST', path, { body: data as Record<string, unknown>, signal });
    },

    update(id: string, changes: Partial<T>, signal?: AbortSignal): Promise<T> {
      return request(http, 'PATCH', `${path}/${encodeURIComponent(id)}`, {
        body: changes as Record<string, unknown>,
        signal,
      });
    },

    delete(id: string, signal?: AbortSignal): Promise<void> {
      return request<void>(http, 'DELETE', `${path}/${encodeURIComponent(id)}`, { signal });
    },

    updateMany(ids: string[], changes: Partial<T>, signal?: AbortSignal): Promise<{ updated: string[] }> {
      return request(http, 'PATCH', path, { body: { ids, changes }, signal });
    },

    deleteMany(ids: string[], signal?: AbortSignal): Promise<{ deleted: string[] }> {
      return request(http, 'DELETE', path, { body: { ids }, signal });
    },
  };
}
