import { describe, it, expect } from './helpers/test.js';import { ClientError, createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

interface MockSpec {
  status: number;
  body?: unknown;
}

function captureFetch(specs: MockSpec[], onRequest?: (request: CapturedRequest) => void): typeof fetch {
  let index = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {})) {
      headers[key] = String(value);
    }
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
    onRequest?.({ url, method, headers, body });
    const spec = specs[Math.min(index, specs.length - 1)]!;
    index += 1;
    const noBody = spec.status === 204 || spec.status === 205 || spec.status === 304;
    return new Response(noBody ? null : spec.body === undefined ? '' : JSON.stringify(spec.body), {
      status: spec.status,
      headers: spec.body === undefined ? {} : { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('createClient — serialization and contract', () => {
  it('find: query serialization (filter JSON / sort / fields / limit / offset)', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch([{ status: 200, body: { rows: [], total: 0, limit: 10, offset: 0 } }], (r) => requests.push(r)),
    });
    await client.objects('lead').find({
      filter: { status: 'open', age: { gt: 18 } },
      sort: [{ field: 'name', direction: 'asc' }, { field: 'created_at', direction: 'desc' }],
      fields: ['id', 'name'],
      limit: 5,
      offset: 10,
    });
    expect(requests).toHaveLength(1);
    const { url, method } = requests[0]!;
    expect(method).toBe('GET');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://localhost:3000/api/objects/lead');
    expect(parsed.searchParams.get('filter')).toBe('{"status":"open","age":{"gt":18}}');
    expect(parsed.searchParams.get('sort')).toBe('name:asc,created_at:desc');
    expect(parsed.searchParams.get('fields')).toBe('id,name');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('offset')).toBe('10');
  });

  it('find: parses RestResult envelope', async () => {
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch([{ status: 200, body: { rows: [{ id: 'L1', name: 'Acme' }], total: 1, limit: 100, offset: 0 } }]),
    });
    const result = await client.objects<{ id: string; name: string }>('lead').find();
    expect(result.total).toBe(1);
    expect(result.rows[0]?.name).toBe('Acme');
  });

  it('auth header: sends Bearer; omits it when there is no apiKey', async () => {
    const withKey: CapturedRequest[] = [];
    const withAuth = createClient({
      baseUrl: 'http://x',
      apiKey: 'sk-1',
      fetch: captureFetch([{ status: 200, body: { rows: [], total: 0, limit: 0, offset: 0 } }], (r) => withKey.push(r)),
    });
    await withAuth.objects('lead').find();
    expect(withKey[0]!.headers.authorization).toBe('Bearer sk-1');

    const noKey: CapturedRequest[] = [];
    const withoutAuth = createClient({
      baseUrl: 'http://x',
      fetch: captureFetch([{ status: 200, body: { rows: [], total: 0, limit: 0, offset: 0 } }], (r) => noKey.push(r)),
    });
    await withoutAuth.objects('lead').find();
    expect(noKey[0]!.headers.authorization).toBeUndefined();
  });

  it('prefix is configurable, trailing slash in baseUrl is normalized', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000/',
      prefix: '/v2',
      fetch: captureFetch([{ status: 200, body: { rows: [], total: 0, limit: 0, offset: 0 } }], (r) => requests.push(r)),
    });
    await client.objects('lead').find();
    expect(requests[0]!.url).toContain('http://localhost:3000/v2/objects/lead');
  });

  it('findOne: 200 returns record; 404 → null', async () => {
    const hit = createClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetch: captureFetch([{ status: 200, body: { id: 'L1', name: 'Acme' } }]),
    });
    expect((await hit.objects<{ id: string }>('lead').findOne('L1'))?.id).toBe('L1');

    const miss = createClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetch: captureFetch([
        { status: 404, body: { error: { code: 'data.recordNotFound', message: 'not found', params: { object: 'lead', id: 'L9' } } } },
      ]),
    });
    expect(await miss.objects('lead').findOne('L9')).toBeNull();
  });

  it('create/update/delete: methods, payload and 204', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetch: captureFetch(
        [
          { status: 201, body: { id: 'L1', name: 'New' } },
          { status: 200, body: { id: 'L1', name: 'Updated' } },
          { status: 204 },
        ],
        (r) => requests.push(r),
      ),
    });
    await client.objects('lead').create({ id: 'L1', name: 'New' });
    await client.objects('lead').update('L1', { name: 'Updated' });
    await client.objects('lead').delete('L1');

    expect(requests.map((r) => r.method)).toEqual(['POST', 'PATCH', 'DELETE']);
    expect(requests[0]!.body).toEqual({ id: 'L1', name: 'New' });
    expect(requests[1]!.body).toEqual({ name: 'Updated' });
    expect(requests[0]!.url).toContain('/api/objects/lead');
    expect(requests[1]!.url).toContain('/api/objects/lead/L1');
  });

  it('non-2xx → ClientError (status/code/message/params)', async () => {
    const client = createClient({
      baseUrl: 'http://x',
      apiKey: 'k',
      fetch: captureFetch([
        { status: 403, body: { error: { code: 'rbac.denied.read', message: 'not allowed', params: { object: 'lead', role: 'ghost' } } } },
      ]),
    });
    let threw: unknown;
    try {
      await client.objects('lead').find();
    } catch (error) {
      threw = error;
    }
    expect(threw instanceof ClientError).toBe(true);
    const err = threw as ClientError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('rbac.denied.read');
    expect(err.params).toEqual({ object: 'lead', role: 'ghost' });
  });

  it('error response without error body → fallback http.internal', async () => {
    const client = createClient({
      baseUrl: 'http://x',
      fetch: captureFetch([{ status: 500, body: 'boom' }]),
    });
    let threw: unknown;
    try {
      await client.objects('lead').find();
    } catch (error) {
      threw = error;
    }
    expect((threw as ClientError).status).toBe(500);
    expect((threw as ClientError).code).toBe('http.internal');
  });

  it('updateMany/deleteMany: batch endpoint serialization (PATCH/DELETE collection routes + ids/changes body)', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { updated: ['L1', 'L2'] } },
          { status: 200, body: { deleted: ['L3'] } },
        ],
        (r) => requests.push(r),
      ),
    });

    const updated = await client.objects('lead').updateMany(['L1', 'L2'], { status: 'won' });
    expect(updated.updated).toEqual(['L1', 'L2']);

    const deleted = await client.objects('lead').deleteMany(['L3']);
    expect(deleted.deleted).toEqual(['L3']);

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ method: 'PATCH', url: 'http://localhost:3000/api/objects/lead', body: { ids: ['L1', 'L2'], changes: { status: 'won' } } });
    expect(requests[1]).toMatchObject({ method: 'DELETE', url: 'http://localhost:3000/api/objects/lead', body: { ids: ['L3'] } });
  });

  it('fetch runs as a bare call (this=undefined, avoiding window.fetch Illegal invocation)', async () => {
    const strictFetch = async function (this: unknown): Promise<Response> {
      if (this !== undefined) throw new Error('fetch invoked with a bound this');
      return new Response(JSON.stringify({ rows: [], total: 0, limit: 0, offset: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createClient({ baseUrl: 'http://x', apiKey: 'k', fetch: strictFetch as typeof fetch });
    await expect(client.objects('lead').find()).resolves.toMatchObject({ total: 0 });
  });

  it('network error (engine unreachable) → wrapped as ClientError(0, http.unreachable) with a clear message', async () => {
    const failingFetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const client = createClient({ baseUrl: 'http://localhost:3000', apiKey: 'k1', fetch: failingFetch });
    let caught: ClientError | undefined;
    try {
      await client.objects('lead').find();
    } catch (e) {
      caught = e instanceof ClientError ? e : undefined;
    }
    expect(caught).not.toBeUndefined();
    expect(caught!.status).toBe(0);
    expect(caught!.code).toBe('http.unreachable');
    expect(caught!.message).toContain('Cannot reach the WeaveKit engine at http://localhost:3000');
  });

  it('derive: shares baseUrl/fetch, swaps prefix and key (per-instance /api/proxy/:id)', async () => {
    const requests: CapturedRequest[] = [];
    const base = createClient({
      baseUrl: 'https://governance.test',
      apiKey: 'gov-key',
      fetch: captureFetch([{ status: 200, body: { objects: [] } }], (r) => requests.push(r)),
    });
    const proxied = base.derive({ prefix: '/api/proxy/instance-1' });
    await proxied.metadata.list();
    expect(requests[0]!.url).toBe('https://governance.test/api/proxy/instance-1/metadata');
    expect(requests[0]!.headers.authorization).toBe('Bearer gov-key');

    // derive can also swap the key and keeps the same baseUrl
    const admin = base.derive({ prefix: '/api/proxy/instance-2', apiKey: 'admin-key' });
    await admin.metadata.list();
    expect(requests[1]!.url).toBe('https://governance.test/api/proxy/instance-2/metadata');
    expect(requests[1]!.headers.authorization).toBe('Bearer admin-key');

    // the base client is unchanged
    await base.metadata.list();
    expect(requests[2]!.url).toBe('https://governance.test/api/metadata');
  });

  it('AbortError (request cancellation) is not wrapped as unreachable, passed through as-is', async () => {
    const abortFetch = (async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch;
    const client = createClient({ baseUrl: 'http://localhost:3000', fetch: abortFetch });
    let aborted = false;
    try {
      await client.objects('lead').find();
    } catch (e) {
      aborted = e instanceof Error && e.name === 'AbortError';
    }
    expect(aborted).toBe(true);
  });
});
