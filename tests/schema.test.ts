import { describe, it, expect } from './helpers/test.js';
import { ClientError, createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function jsonFetch(status: number, body: string, onRequest?: (request: CapturedRequest) => void): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {})) headers[key] = String(value);
    onRequest?.({ url, method, headers, body: typeof init?.body === 'string' ? init.body : undefined });
    return new Response(body, {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }) as typeof fetch;
}

function clientFor(fetchImpl: typeof fetch) {
  return createClient({ baseUrl: 'http://localhost:3000', apiKey: 'k1', fetch: fetchImpl });
}

describe('client.schema object schema source access', () => {
  it('getSource returns {source, version} (GET /objects/:name/schema, Bearer)', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(
      jsonFetch(200, JSON.stringify({ source: '{"name":"lead"}', version: 'ab'.repeat(32) }), (r) => requests.push(r)),
    );
    const doc = await client.schema.getSource('lead');
    expect(doc?.source).toBe('{"name":"lead"}');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/objects/lead/schema');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
  });

  it('getSource 404 → null; 403 → ClientError passed through', async () => {
    expect(await clientFor(jsonFetch(404, '')).schema.getSource('ghost')).toBeNull();
    try {
      await clientFor(jsonFetch(403, JSON.stringify({ error: { code: 'rbac.denied.update', message: 'no' } }))).schema.getSource('lead');
      expect.unreachable('expected rejection');
    } catch (error) {
      expect((error as ClientError).status).toBe(403);
      expect((error as ClientError).code).toBe('rbac.denied.update');
    }
  });

  it('save sends {source, expectVersion?, force?}, 409 passed through', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(jsonFetch(200, JSON.stringify({ ok: true, committed: true, version: 'v' }), (r) => requests.push(r)));
    await client.schema.save('lead', '{"name":"lead"}', { expectVersion: 'old' });
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/objects/lead/schema');
    expect(JSON.parse(requests[0]!.body!)).toEqual({ source: '{"name":"lead"}', expectVersion: 'old' });

    const conflict = clientFor(jsonFetch(409, JSON.stringify({ error: { code: 'source.versionMismatch', message: 'stale', params: { version: 'cur' } } })));
    try {
      await conflict.schema.save('lead', '{}', { expectVersion: 'stale' });
      expect.unreachable('expected 409');
    } catch (error) {
      expect((error as ClientError).status).toBe(409);
      expect((error as ClientError).code).toBe('source.versionMismatch');
    }
  });
});
