import { describe, it, expect } from './helpers/test.js';
import { createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function captureFetch(requests: CapturedRequest[]): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(Object.entries(init?.headers ?? {}).map(([key, value]) => [key, String(value)])),
    });
    return new Response(JSON.stringify({ rows: [], total: 0, limit: 0, offset: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('client locale', () => {
  it('sends Accept-Language on REST requests', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({ baseUrl: 'http://x', locale: 'zh-CN', fetch: captureFetch(requests) });
    await client.objects('lead').find();
    expect(requests[0]!.headers['accept-language']).toBe('zh-CN');
  });

  it('evaluates a locale getter per request (runtime switch)', async () => {
    const requests: CapturedRequest[] = [];
    let locale = 'zh';
    const client = createClient({ baseUrl: 'http://x', locale: () => locale, fetch: captureFetch(requests) });
    await client.objects('lead').find();
    locale = 'fr';
    await client.objects('lead').find();
    expect(requests[0]!.headers['accept-language']).toBe('zh');
    expect(requests[1]!.headers['accept-language']).toBe('fr');
  });

  it('omits the header without a locale and supports setLocale()', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({ baseUrl: 'http://x', fetch: captureFetch(requests) });
    await client.objects('lead').find();
    expect(requests[0]!.headers['accept-language']).toBeUndefined();
    client.setLocale('de');
    await client.objects('lead').find();
    expect(requests[1]!.headers['accept-language']).toBe('de');
    client.setLocale(undefined);
    await client.objects('lead').find();
    expect(requests[2]!.headers['accept-language']).toBeUndefined();
  });

  it('derive preserves locale unless overridden', async () => {
    const requests: CapturedRequest[] = [];
    const base = createClient({ baseUrl: 'http://x', locale: 'zh', fetch: captureFetch(requests) });
    await base.derive({ prefix: '/api/proxy/a' }).objects('lead').find();
    await base.derive({ prefix: '/api/proxy/a', locale: 'de' }).objects('lead').find();
    expect(requests[0]!.headers['accept-language']).toBe('zh');
    expect(requests[1]!.headers['accept-language']).toBe('de');
  });

  it('sends Accept-Language on SSE subscriptions', async () => {
    const requests: CapturedRequest[] = [];
    const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({
        url: String(input),
        headers: Object.fromEntries(Object.entries(init?.headers ?? {}).map(([key, value]) => [key, String(value)])),
      });
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }) as typeof fetch;
    const client = createClient({ baseUrl: 'http://x', locale: () => 'zh', fetch: fetchImpl });
    const sub = client.subscribe({ onEvent: () => {}, backoffMs: 1000 });
    await sleep(30);
    sub.close();
    expect(requests[0]!.headers['accept-language']).toBe('zh');
  });
});
