import { describe, it, expect } from './helpers/test.js';
import { createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

function captureFetch(specs: { status: number; body?: unknown }[], onRequest?: (request: CapturedRequest) => void): typeof fetch {
  let index = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {})) headers[key] = String(value);
    onRequest?.({ url, method, headers });
    const spec = specs[Math.min(index, specs.length - 1)]!;
    index += 1;
    return new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

const DESCRIPTOR = {
  name: 'lead',
  labels: { en: 'Lead' },
  fields: [
    { name: 'id', type: 'string', primary: true },
    { name: 'name', type: 'string', required: true },
  ],
  relations: [],
  permissions: { read: 'own', create: true, update: ['name'], delete: true, excludedFields: [] },
};

describe('client.metadata / permissions / audit accessors (frontend metadata contract)', () => {
  it('metadata.list / metadata.get / permissions serialization and parsing', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { objects: [DESCRIPTOR] } },
          { status: 200, body: DESCRIPTOR },
          { status: 200, body: { objects: [{ name: 'lead', labels: { en: 'Lead' }, permissions: DESCRIPTOR.permissions }] } },
        ],
        (r) => requests.push(r),
      ),
    });

    const list = await client.metadata.list();
    expect(list.objects[0]!.name).toBe('lead');
    expect(list.objects[0]!.fields.find((f) => f.name === 'id')?.primary).toBe(true);

    const one = await client.metadata.get('lead');
    expect(one.labels?.en).toBe('Lead');

    const perms = await client.permissions();
    expect(perms.objects[0]!.permissions.update).toEqual(['name']);

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['GET', 'http://localhost:3000/api/metadata'],
      ['GET', 'http://localhost:3000/api/metadata?object=lead'],
      ['GET', 'http://localhost:3000/api/permissions'],
    ]);
    expect(requests.every((r) => r.headers.authorization === 'Bearer k1')).toBe(true);
  });

  it('audit.query: param mapping (from/to ISO, limit/offset, action/object) and empty args with no query', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://x',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { rows: [], total: 0, limit: 100, offset: 0 } },
          { status: 200, body: { rows: [], total: 0, limit: 10, offset: 0 } },
        ],
        (r) => requests.push(r),
      ),
    });

    await client.audit.query();
    expect(requests[0]!.url).toBe('http://x/api/audit');

    const from = new Date('2026-01-01T00:00:00Z');
    await client.audit.query({ action: 'create', object: 'lead', from, limit: 10, offset: 0 });
    const parsed = new URL(requests[1]!.url);
    expect(parsed.searchParams.get('action')).toBe('create');
    expect(parsed.searchParams.get('object')).toBe('lead');
    expect(parsed.searchParams.get('from')).toBe(from.toISOString());
    expect(parsed.searchParams.get('limit')).toBe('10');
    expect(parsed.searchParams.get('offset')).toBe('0');
  });

  it('approvals.list: filter/pagination/sort mapping + empty args with no query', async () => {
    const requests: CapturedRequest[] = [];
    const rows = [
      {
        approvalKey: 'ap-1',
        action: 'mcp.tool.x',
        args: { a: 1 },
        status: 'pending',
        createdAt: '2026-08-31T10:00:00Z',
        actorKey: 'agent-1',
      },
    ];
    const client = createClient({
      baseUrl: 'http://x',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { rows, total: 1, limit: 20, offset: 0 } },
          { status: 200, body: { rows: [], total: 0, limit: 100, offset: 0 } },
        ],
        (r) => requests.push(r),
      ),
    });

    const res = await client.approvals.list({ status: 'pending', limit: 20, sort: { field: 'createdAt', order: 'DESC' } });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.approvalKey).toBe('ap-1');
    expect(res.total).toBe(1);
    const parsed = new URL(requests[0]!.url);
    expect(parsed.searchParams.get('status')).toBe('pending');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.get('sort')).toBe('createdAt');
    expect(parsed.searchParams.get('order')).toBe('DESC');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');

    await client.approvals.list();
    expect(requests[1]!.url).toBe('http://x/api/approvals');
  });

  it('approvals.approve / reject: POST to their own paths (admin write)', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://x',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { approvalKey: 'ap-1', status: 'approved', approver: 'u-admin' } },
          { status: 200, body: { approvalKey: 'ap-1', status: 'rejected', approver: 'u-admin' } },
        ],
        (r) => requests.push(r),
      ),
    });

    const approved = await client.approvals.approve('ap-1');
    expect(approved).toEqual({ approvalKey: 'ap-1', status: 'approved', approver: 'u-admin' });
    const rejected = await client.approvals.reject('ap-1');
    expect(rejected.status).toBe('rejected');

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['POST', 'http://x/api/approvals/ap-1/approve'],
      ['POST', 'http://x/api/approvals/ap-1/reject'],
    ]);
  });
});
