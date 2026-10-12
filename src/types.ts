import type { Filter, SortDir, TotalMode } from '@weave-kit/contract';

/** one sort clause; serialized as `field:direction` on the wire */
export interface FindSort {
  field: string;
  direction: SortDir;
}

/** list query params — serialized to the REST contract (filter/sort/fields/limit/offset) */
export interface FindParams {
  /** equality/operator filter object (JSON-encoded on the wire) */
  filter?: Filter;
  sort?: FindSort[];
  limit?: number;
  offset?: number;
  /** column projection whitelist */
  fields?: string[];
  /** how the server computes `total`: `exact` (default), `estimate` (reltuples) or `none` (omit) */
  total?: TotalMode;
}

/** single-record read params */
export interface FindOneParams {
  fields?: string[];
}

/** serialize FindParams to REST query string entries */
export function buildFindQuery(params: FindParams): Record<string, string> | undefined {
  const query: Record<string, string> = {};
  if (params.filter !== undefined) query.filter = JSON.stringify(params.filter);
  if (params.sort !== undefined) query.sort = params.sort.map((s) => `${s.field}:${s.direction}`).join(',');
  if (params.fields !== undefined) query.fields = params.fields.join(',');
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.offset !== undefined) query.offset = String(params.offset);
  if (params.total !== undefined) query.total = params.total;
  return Object.keys(query).length === 0 ? undefined : query;
}
