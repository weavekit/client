import { describe, it, expect } from './helpers/test.js';
import { ClientError, createClient, type LiveEvent } from '../src/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** a mock fetch that serves a sequence of SSE response bodies (stream closes → reconnect) */
function sseFetch(bodies: string[][]): { fetchImpl: typeof fetch; requests: { url: string; headers: Record<string, string> }[] } {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  let call = 0;
  const encoder = new TextEncoder();
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(Object.entries(init?.headers ?? {}).map(([k, v]) => [k, String(v)])),
    });
    const blocks = bodies[call] ?? []; // serve an empty stream once the provided sequences are exhausted (reconnect loop but no events)
    call += 1;
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < blocks.length) {
          controller.enqueue(encoder.encode(blocks[i]!));
          i += 1;
        } else {
          controller.close();
        }
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const BLOCK = (id: number, type: string, payload: Record<string, unknown>) =>
  `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify({ seq: id, type, payload })}\n\n`;

describe('client.subscribe — SSE stream parsing / auth / reconnect replay / close', () => {
  it('parses event blocks (id/event/data), skips : ping comment blocks', async () => {
    const { fetchImpl } = sseFetch([
      [': ping\n\n', BLOCK(1, 'record.created', { object: 'lead', id: 'L1' }), BLOCK(2, 'schema.changed', { kind: 'schema' })],
    ]);
    const client = createClient({ baseUrl: 'http://x', apiKey: 'k1', fetch: fetchImpl });
    const events: LiveEvent[] = [];
    const sub = client.subscribe({ onEvent: (e) => events.push(e), backoffMs: 1000 });
    await sleep(80);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ seq: 1, type: 'record.created', payload: { object: 'lead', id: 'L1' } });
    expect(events[1]).toMatchObject({ type: 'schema.changed', payload: { kind: 'schema' } });
    sub.close();
  });

  it('auth header Bearer + reconnect after stream ends with Last-Event-ID replay', async () => {
    const { fetchImpl, requests } = sseFetch([
      [BLOCK(7, 'record.created', { object: 'lead', id: 'L1' })],
      [BLOCK(8, 'record.updated', { object: 'lead', id: 'L1' })],
    ]);
    const client = createClient({ baseUrl: 'http://x', apiKey: 'k1', fetch: fetchImpl });
    const events: LiveEvent[] = [];
    const sub = client.subscribe({ onEvent: (e) => events.push(e), backoffMs: 10, maxBackoffMs: 50 });
    await sleep(150); // first stream fully read + reconnect after disconnect
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests[0]!.headers.authorization).toBe('Bearer k1');
    expect(requests[0]!.headers['last-event-id']).toBeUndefined();
    expect(requests[1]!.headers['last-event-id']).toBe('7');
    expect(events.map((e) => e.type)).toEqual(['record.created', 'record.updated']);
    sub.close();
  });

  it('401 triggers onError and does not auto-reconnect', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { code: 'auth.missingKey', message: 'x' } }), { status: 401 });
    }) as typeof fetch;
    const client = createClient({ baseUrl: 'http://x', fetch: fetchImpl });
    const errors: Error[] = [];
    client.subscribe({ onEvent: () => {}, onError: (e) => errors.push(e), backoffMs: 10 });
    await sleep(50);
    expect(calls).toBe(1);
    expect(errors[0]).toBeInstanceOf(ClientError);
    expect((errors[0] as ClientError).status).toBe(401);
  });

  it('close() stops the connection and reconnection', async () => {
    let calls = 0;
    const { fetchImpl } = sseFetch([]);
    const wrapped = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls += 1;
      return fetchImpl(input, init);
    }) as typeof fetch;
    const client = createClient({ baseUrl: 'http://x', apiKey: 'k1', fetch: wrapped });
    const events: LiveEvent[] = [];
    const sub = client.subscribe({ onEvent: (e) => events.push(e), backoffMs: 10, maxBackoffMs: 50 });
    await sleep(40);
    const callsAfterConnect = calls;
    sub.close();
    await sleep(60);
    expect(calls).toBe(callsAfterConnect); // no further reconnects
    expect(events).toHaveLength(0);
  });
});
