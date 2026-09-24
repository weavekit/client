import { ClientError } from './http.js';
import type { HttpOptions } from './http.js';

/**
 * Live subscription — fetch-based SSE client. `fetch` can set the
 * Authorization header (native EventSource cannot), so the API key travels in
 * the Bearer header, never in the query string. Auto-reconnects with backoff
 * and sends `Last-Event-ID` so the engine replays events missed while
 * disconnected. A `schema.changed` event (with `payload.replayGap`) is emitted
 * when the engine can no longer replay (process restart / ring overflow) —
 * refetch metadata/permissions via REST.
 */

/** one live event (wire shape: `{ seq?, ts?, type, payload }`) */
export interface LiveEvent {
  seq?: number;
  ts?: string;
  type: string;
  payload: Record<string, unknown>;
}

/** the `record.transitioned` live event — a workflow transition (additive to `record.updated`) */
export interface RecordTransitionedEvent {
  seq?: number;
  ts?: string;
  type: 'record.transitioned';
  payload: { object: string; id: string; from: string; to: string; action: string };
}

export interface SubscribeOptions {
  onEvent(event: LiveEvent): void;
  onOpen?(): void;
  onError?(error: Error): void;
  /** reconnect backoff base ms; doubles per retry (default 1000) */
  backoffMs?: number;
  /** reconnect backoff cap ms (default 15000) */
  maxBackoffMs?: number;
}

export interface Subscription {
  close(): void;
}

interface ParsedBlock {
  event: LiveEvent;
  id?: number;
}

/** parse one SSE block; null for comment/ping-only blocks */
function parseBlock(block: string): ParsedBlock | null {
  let id: number | undefined;
  let type: string | undefined;
  const dataParts: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith(':') || line === '') continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).replace(/^ /, '');
    if (field === 'id') id = Number.parseInt(value, 10);
    else if (field === 'event') type = value;
    else if (field === 'data') dataParts.push(value);
  }
  if (dataParts.length === 0) return null; // heartbeat / comment only
  let event: LiveEvent;
  try {
    const parsed = JSON.parse(dataParts.join('\n')) as LiveEvent;
    if (typeof parsed.type !== 'string') throw new Error('no type');
    event = parsed;
  } catch {
    event = { type: type ?? 'message', payload: { data: dataParts.join('\n') } };
  }
  return { event, id };
}

/** build a `client.subscribe` function bound to one client's transport */
export function createSubscriber(http: HttpOptions) {
  return function subscribe(options: SubscribeOptions): Subscription {
    let closed = false;
    let retries = 0;
    let lastSeq: number | undefined;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const close = (): void => {
      closed = true;
      controller?.abort();
      if (timer !== undefined) clearTimeout(timer);
    };

    const scheduleReconnect = (): void => {
      if (closed) return;
      const base = options.backoffMs ?? 1000;
      const max = options.maxBackoffMs ?? 15000;
      const delay = Math.min(base * 2 ** retries, max);
      retries += 1;
      timer = setTimeout(() => {
        timer = undefined;
        void connect();
      }, delay);
      // a reconnect timer must never keep the process alive (subscription may be abandoned)
      timer.unref?.();
    };

    const connect = async (): Promise<void> => {
      if (closed) return;
      controller = new AbortController();
      const url = new URL(`${http.baseUrl}${http.prefix}/events`);
      const headers: Record<string, string> = { accept: 'text/event-stream' };
      if (http.apiKey !== undefined) headers.authorization = `Bearer ${http.apiKey}`;
      if (lastSeq !== undefined) headers['last-event-id'] = String(lastSeq);

      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let buffer = '';
      const decoder = new TextDecoder();

      try {
        // bare call — `http.fetchImpl(...)` sets `this` to the http object and
        // native `window.fetch` throws "Illegal invocation"
        const fetchImpl = http.fetchImpl;
        const res = await fetchImpl(url.toString(), { method: 'GET', headers, signal: controller.signal });
        if (!res.ok) throw new ClientError(res.status, '', res.statusText);
        if (res.body === null) throw new Error('empty response body');
        options.onOpen?.();
        retries = 0;
        reader = res.body.getReader();
        for (;;) {
          if (closed) return;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseBlock(block);
            if (parsed === null) continue;
            if (parsed.id !== undefined) lastSeq = parsed.id;
            else if (parsed.event.seq !== undefined) lastSeq = parsed.event.seq;
            options.onEvent(parsed.event);
          }
        }
        // stream ended cleanly (server closed) → reconnect
        scheduleReconnect();
      } catch (error) {
        if (closed) return;
        if (error instanceof ClientError && (error.status === 401 || error.status === 403)) {
          options.onError?.(error);
          return; // auth failures never auto-retry
        }
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
        scheduleReconnect();
      }
    };

    void connect();
    return { close };
  };
}
