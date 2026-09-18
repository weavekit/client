import { describe, it, expect } from './helpers/test.js';
import { createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function captureFetch(specs: { status: number; body?: unknown }[], onRequest?: (request: CapturedRequest) => void): typeof fetch {
  let index = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {})) headers[key] = String(value);
    let body: unknown = undefined;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    onRequest?.({ url, method, body, headers });
    const spec = specs[Math.min(index, specs.length - 1)]!;
    index += 1;
    return new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('client.guardrails accessors (M10c)', () => {
  it('list serializes to GET /api/guardrails/policies', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch([{ status: 200, body: { policies: [{ name: 'approve-grant.js', version: 'v1' }] } }], (r) => requests.push(r)),
    });
    const result = await client.guardrails.list();
    expect(result.policies).toEqual([{ name: 'approve-grant.js', version: 'v1' }]);
    expect(requests[0]!.url).toBe('http://localhost:3000/api/guardrails/policies');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
  });

  it('getSource parses the source, 404 → null', async () => {
    const client404 = createClient({
      baseUrl: 'http://localhost:3000',
      fetch: captureFetch([{ status: 404 }]),
    });
    expect(await client404.guardrails.getSource('approve-grant.js')).toBeNull();

    const client = createClient({
      baseUrl: 'http://localhost:3000',
      fetch: captureFetch([{ status: 200, body: { source: 'export default {};\n', version: 'v1' } }]),
    });
    const doc = await client.guardrails.getSource('approve-grant.js');
    expect(doc).toEqual({ source: 'export default {};\n', version: 'v1' });
  });

  it('save PUTs the source with expectVersion', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      fetch: captureFetch([{ status: 200, body: { ok: true, committed: true, version: 'v2' } }], (r) => requests.push(r)),
    });
    const result = await client.guardrails.save('approve-grant.js', 'export default {};\n', { expectVersion: 'v1' });
    expect(result).toEqual({ ok: true, committed: true, version: 'v2' });
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/guardrails/policies/approve-grant.js');
    expect(requests[0]!.body).toEqual({ source: 'export default {};\n', expectVersion: 'v1' });
  });

  it('history GETs /api/guardrails/policies/:name/history and returns the commit list', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          {
            status: 200,
            body: {
              name: 'approve-grant.js',
              commits: [
                { sha: 'a1', author: 'violet', email: 'v@x.io', date: '2026-01-01T00:00:00Z', message: 'chore(policies): update approve-grant.js', source: 'export default {};\n', version: 'v2' },
                { sha: 'b2', author: 'violet', email: 'v@x.io', date: '2026-01-01T00:00:00Z', message: 'chore(policies): update approve-grant.js', source: 'export default {};\n', version: 'v1' },
              ],
            },
          },
        ],
        (r) => requests.push(r),
      ),
    });
    const result = await client.guardrails.history('approve-grant.js');
    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]!.sha).toBe('a1');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('http://localhost:3000/api/guardrails/policies/approve-grant.js/history');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
  });
});
