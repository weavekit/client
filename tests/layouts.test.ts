import { describe, it, expect } from './helpers/test.js';
import { ClientError, createClient, layoutPagePath } from '../src/index.js';

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

describe('client.layouts page layout source access (path-mirrored addressing)', () => {
  it('layoutPagePath maps the three page forms', () => {
    expect(layoutPagePath({ kind: 'shell' })).toBe('app.layout');
    expect(layoutPagePath({ kind: 'custom', id: 'dash' })).toBe('dash/layout');
    expect(layoutPagePath({ kind: 'object', id: 'tickets', view: 'show' })).toBe('tickets/show.layout');
    expect(layoutPagePath({ kind: 'object', id: 'tickets', view: 'list' })).toBe('tickets/list.layout');
  });

  it('getSource returns {source, version} (GET /pages/<path>)', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(
      jsonFetch(200, JSON.stringify({ source: '{"viewports":{}}', version: 'ab'.repeat(32) }), (r) => requests.push(r)),
    );
    const result = await client.layouts.getSource({ kind: 'object', id: 'tickets', view: 'show' });
    expect(result?.source).toBe('{"viewports":{}}');
    expect(result?.version).toMatch(/^[0-9a-f]{64}$/);
    expect(requests[0]!.url).toBe('http://localhost:3000/api/pages/tickets/show.layout');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
  });

  it('getSource 404 → null; non-404 → ClientError; network failure → http.unreachable', async () => {
    expect((await clientFor(jsonFetch(404, '')).layouts.getSource({ kind: 'custom', id: 'ghost' }))).toBeNull();

    try {
      await clientFor(jsonFetch(403, JSON.stringify({ error: { code: 'rbac.denied.update', message: 'no' } }))).layouts.getSource({
        kind: 'shell',
      });
      expect.unreachable('expected rejection');
    } catch (error) {
      expect((error as ClientError).status).toBe(403);
      expect((error as ClientError).code).toBe('rbac.denied.update');
    }

    try {
      await clientFor((() => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch).layouts.getSource({ kind: 'shell' });
      expect.unreachable('expected rejection');
    } catch (error) {
      expect((error as ClientError).status).toBe(0);
      expect((error as ClientError).code).toBe('http.unreachable');
    }
  });

  it('save sends {source, expectVersion?, force?}, 409 passes through conflict params', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(jsonFetch(200, JSON.stringify({ ok: true, committed: true, version: 'x' }), (r) => requests.push(r)));
    await client.layouts.save({ kind: 'custom', id: 'dash' }, '{"viewports":{}}', { expectVersion: 'old', force: true });
    const body = JSON.parse(requests[0]!.body!) as Record<string, unknown>;
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/pages/dash/layout');
    expect(body).toEqual({ source: '{"viewports":{}}', expectVersion: 'old', force: true });

    const conflict = clientFor(jsonFetch(409, JSON.stringify({ error: { code: 'source.versionMismatch', message: 'stale', params: { version: 'cur' } } })));
    try {
      await conflict.layouts.save({ kind: 'object', id: 'tickets', view: 'list' }, '{}', { expectVersion: 'stale' });
      expect.unreachable('expected 409');
    } catch (error) {
      expect((error as ClientError).status).toBe(409);
      expect((error as ClientError).code).toBe('source.versionMismatch');
      expect((error as ClientError).params).toEqual({ version: 'cur' });
    }
  });

  it('list returns the page directory (GET /pages)', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(
      jsonFetch(200, JSON.stringify([{ kind: 'shell', id: 'app', path: 'app.layout' }]), (r) => requests.push(r)),
    );
    const pages = await client.layouts.list();
    expect(pages[0]).toEqual({ kind: 'shell', id: 'app', path: 'app.layout' });
    expect(requests[0]!.url).toBe('http://localhost:3000/api/pages');
  });

  it('create/rename/delete custom pages', async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const record = (r: CapturedRequest) => calls.push({ method: r.method, url: r.url, body: r.body });
    const okFetch = jsonFetch(200, '{}', record);
    const client = clientFor(okFetch);

    await client.layouts.create('dash', { source: '{"viewports":{}}' });
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe('http://localhost:3000/api/pages');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ id: 'dash', source: '{"viewports":{}}' });

    await client.layouts.rename('dash', 'dash2');
    expect(calls[1]!.method).toBe('PATCH');
    expect(calls[1]!.url).toBe('http://localhost:3000/api/pages/dash');
    expect(JSON.parse(calls[1]!.body!)).toEqual({ newId: 'dash2' });

    await client.layouts.delete('dash2');
    expect(calls[2]!.method).toBe('DELETE');
    expect(calls[2]!.url).toBe('http://localhost:3000/api/pages/dash2');
  });

  it('saveDesign atomic transaction (PUT /pages/:object/design)', async () => {
    const requests: CapturedRequest[] = [];
    const client = clientFor(jsonFetch(200, JSON.stringify({ ok: true, committed: true }), (r) => requests.push(r)));
    await client.layouts.saveDesign({
      object: 'lead',
      show: { source: '{"show":1}', expectVersion: 'a' },
      schema: { source: '{"schema":1}' },
      force: true,
    });
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/pages/lead/design');
    const body = JSON.parse(requests[0]!.body!) as Record<string, unknown>;
    expect(body).toEqual({ show: { source: '{"show":1}', expectVersion: 'a' }, schema: { source: '{"schema":1}' }, force: true });
  });
});
