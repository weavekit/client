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

describe('client.identities accessors', () => {
  it('list serializes to GET /api/identities and parses roles', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch(
        [{ status: 200, body: { identities: [{ ref: 'support', id: 'u-2', roles: ['support'], teamId: 't1' }] } }],
        (r) => requests.push(r),
      ),
    });
    const result = await client.identities.list();
    expect(result.identities).toEqual([{ ref: 'support', id: 'u-2', roles: ['support'], teamId: 't1' }]);
    expect(requests[0]!.url).toBe('http://localhost:3000/api/identities');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
  });
});
