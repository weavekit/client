import { describe, it, expect } from './helpers/test.js';
import { createClient } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
}

function captureFetch(specs: { status: number; body?: unknown }[], onRequest?: (request: CapturedRequest) => void): typeof fetch {
  let index = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    onRequest?.({ url: String(input), method: init?.method ?? 'GET' });
    const spec = specs[Math.min(index, specs.length - 1)]!;
    index += 1;
    return new Response(JSON.stringify(spec.body), {
      status: spec.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('client.workflow accessor', () => {
  it('reads state + available actions and fires a transition', async () => {
    const requests: CapturedRequest[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'k1',
      fetch: captureFetch(
        [
          { status: 200, body: { state: 'draft', initial: 'draft', actions: [{ action: 'submit', to: 'pending' }] } },
          { status: 200, body: { id: 'T1', status: 'pending' } },
        ],
        (r) => requests.push(r),
      ),
    });

    const wf = await client.workflow.get('ticket', 'T1');
    expect(wf.state).toBe('draft');
    expect(wf.actions).toEqual([{ action: 'submit', to: 'pending' }]);

    const updated = await client.workflow.transition<{ status: string }>('ticket', 'T1', 'submit');
    expect(updated.status).toBe('pending');

    expect(requests).toEqual([
      { url: 'http://localhost:3000/api/objects/ticket/T1/workflow', method: 'GET' },
      { url: 'http://localhost:3000/api/objects/ticket/T1/transitions/submit', method: 'POST' },
    ]);
  });
});
