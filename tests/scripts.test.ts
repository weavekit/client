import { describe, it, expect } from "./helpers/test.js";
import { createClient } from "../src/index.js";
import { ClientError } from "../src/index.js";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function textFetch(
  status: number,
  body: string,
  onRequest?: (request: CapturedRequest) => void,
): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {}))
      headers[key] = String(value);
    onRequest?.({ url, method, headers, body: typeof init?.body === "string" ? init.body : undefined });
    return new Response(body, {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }) as typeof fetch;
}

describe("client.scripts (object-level client.js source access)", () => {
  it("scripts.getSource maps non-404 errors to ClientError (error body parsing)", async () => {
    const body = JSON.stringify({
      error: { code: "data.objectUnknown", message: "unknown object" },
    });
    const client = createClient({
      baseUrl: "http://localhost:3000",
      apiKey: "k1",
      fetch: textFetch(403, body),
    });

    try {
      await client.scripts.getSource("lead", "server");
      expect.unreachable("expected scripts.getSource to reject on 403");
    } catch (error) {
      expect(error).toBeInstanceOf(ClientError);
      const e = error as ClientError;
      expect(e.status).toBe(403);
      expect(e.code).toBe("data.objectUnknown");
    }
  });

  it("scripts.getSource maps network failure to http.unreachable", async () => {
    const client = createClient({
      baseUrl: "http://localhost:3000",
      apiKey: "k1",
      fetch: (() => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
    });

    try {
      await client.scripts.getSource("lead", "show.client");
      expect.unreachable("expected scripts.getSource to reject on network failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ClientError);
      const e = error as ClientError;
      expect(e.status).toBe(0);
      expect(e.code).toBe("http.unreachable");
    }
  });

  it("scripts.getSource reads admin editor doc and maps 404", async () => {
    const requests: CapturedRequest[] = [];
    const body = JSON.stringify({ source: "export function validate() {}\n", version: "v1" });
    const client = createClient({
      baseUrl: "http://localhost:3000",
      apiKey: "admin-key",
      fetch: textFetch(200, body, (request) => requests.push(request)),
    });

    expect(await client.scripts.getSource("purchase/order", "server")).toEqual({
      source: "export function validate() {}\n",
      version: "v1",
    });
    expect(requests[0]!.url).toBe("http://localhost:3000/api/objects/purchase%2Forder/scripts/server");
    expect(requests[0]!.headers.authorization).toBe("Bearer admin-key");

    const missing = createClient({ baseUrl: "http://localhost:3000", fetch: textFetch(404, "") });
    expect(await missing.scripts.getSource("lead", "show.client")).toBeNull();
  });

  it("scripts.save sends source and reserved version and returns commit metadata", async () => {
    const requests: CapturedRequest[] = [];
    const response = JSON.stringify({ ok: true, committed: true, version: "v2" });
    const client = createClient({
      baseUrl: "http://localhost:3000",
      apiKey: "admin-key",
      fetch: textFetch(200, response, (request) => requests.push(request)),
    });

    expect(
      await client.scripts.save("lead", "show.client", "export function onValidate() {}", { expectVersion: "v1" }),
    ).toEqual({ ok: true, committed: true, version: "v2" });
    expect(requests[0]!.method).toBe("PUT");
    expect(requests[0]!.url).toBe("http://localhost:3000/api/objects/lead/scripts/show.client");
    expect(requests[0]!.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(requests[0]!.body!)).toEqual({
      source: "export function onValidate() {}",
      expectVersion: "v1",
    });
  });

  it("scripts.save preserves REST errors as ClientError", async () => {
    const body = JSON.stringify({ error: { code: "rbac.denied.update", message: "forbidden" } });
    const client = createClient({ baseUrl: "http://localhost:3000", fetch: textFetch(403, body) });
    let thrown: unknown;
    try {
      await client.scripts.save("lead", "server", "");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ClientError);
    expect((thrown as ClientError).status).toBe(403);
    expect((thrown as ClientError).code).toBe("rbac.denied.update");
  });
});
