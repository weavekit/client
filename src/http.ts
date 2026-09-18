import type { ApiErrorBody } from '@weave-kit/engine';

/** uniform error surfaced from the engine REST layer (see ApiErrorBody) */
export class ClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly params?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, params?: Record<string, unknown>) {
    super(message);
    this.name = 'ClientError';
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

/** resolved transport settings for a client */
export interface HttpOptions {
  baseUrl: string;
  prefix: string;
  apiKey?: string;
  fetchImpl: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string>;
  body?: unknown;
  /** optional AbortSignal for request cancellation (react-admin supportAbortSignal) */
  signal?: AbortSignal;
}

async function parseErrorBody(res: Response): Promise<ApiErrorBody['error'] | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = (body as ApiErrorBody).error;
      return { code: error.code, message: error.message, params: error.params };
    }
  } catch {
    // not JSON — fall through to a generic error
  }
  return undefined;
}

/** one REST request: URL + query serialization, auth header, JSON body, error mapping */
export async function request<T>(http: HttpOptions, method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${http.baseUrl}${http.prefix}${path}`);
  if (options.query !== undefined) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (http.apiKey !== undefined) headers.authorization = `Bearer ${http.apiKey}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  // invoke fetch as a bare call — `http.fetchImpl(...)` would set `this` to the
  // http object and native `window.fetch` throws "Illegal invocation"
  const fetchImpl = http.fetchImpl;
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    // an aborted request (user cancelled / query superseded) is not an engine
    // failure — let it propagate so callers (react-admin) ignore it
    if (error instanceof Error && error.name === 'AbortError') throw error;
    // network-level failure (engine down / mid hot-reload / offline): surface a
    // typed, actionable error instead of a raw fetch `TypeError: Failed to fetch`
    throw new ClientError(0, 'http.unreachable', `Cannot reach the WeaveKit engine at ${http.baseUrl} — it may be down or restarting; check the server terminal`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (!res.ok) {
    const error = await parseErrorBody(res);
    throw new ClientError(res.status, error?.code ?? 'http.internal', error?.message ?? res.statusText, error?.params);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
