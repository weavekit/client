# API reference

## `createClient(options): Client`

```ts
interface ClientOptions {
  baseUrl: string;          // engine base URL, e.g. 'http://localhost:3000'
  prefix?: string;          // REST prefix, defaults to '/api'
  apiKey?: string;          // sent as `Authorization: Bearer <apiKey>`
  fetch?: typeof fetch;     // inject for testing / custom transport (default: global fetch)
}
```

```ts
interface Client {
  objects<T = Record<string, unknown>>(name: string): ObjectsClient<T>;
}
```

## `objects<T>(name): ObjectsClient<T>`

All methods return `Promise`s; non-2xx responses throw `ClientError`.

### `find(params?)`

```ts
async find(params?: FindParams): Promise<RestResult<T>>
```

| Param | Type | Wire format |
| --- | --- | --- |
| `filter` | `Filter` | JSON-encoded query param |
| `sort` | `{ field: string; direction: 'asc' \| 'desc' }[]` | `field:direction,...` |
| `fields` | `string[]` | comma-separated projection |
| `limit` | `number` | int |
| `offset` | `number` | int |

```ts
interface RestResult<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}
```

`Filter` supports exact values and operators — `{ gt, gte, lt, lte, ne, in, contains }`:

```ts
await leads.find({ filter: { score: { gte: 10 }, tags: { contains: 'hot' } } });
```

### `findOne(id, params?)`

```ts
async findOne(id: string, params?: { fields?: string[] }): Promise<T | null>
```

Returns the record, or `null` when the engine answers `404` (`data.recordNotFound`) — e.g. the row is outside the caller's RBAC scope.

### `create(data)`

```ts
async create(data: Partial<T>): Promise<T>
```

`POST` to the collection; resolves the created record. Required fields are enforced server-side (`400`).

### `update(id, changes)`

```ts
async update(id: string, changes: Partial<T>): Promise<T>
```

`PATCH` on the record. Updating a row outside the caller's scope throws `ClientError` with status `404`.

### `delete(id)`

```ts
async delete(id: string): Promise<void>
```

`DELETE`; resolves on `204`.

## `ClientError`

```ts
class ClientError extends Error {
  status: number;            // 401/403/404/400/500/...
  code: string;              // engine error code, e.g. 'rbac.denied.read'
  params?: Record<string, unknown>;
  message: string;
}
```

Thrown for every non-2xx response; the body is parsed from the engine's uniform error envelope `{ error: { code, message, params? } }` (falls back to `http.internal` when unparseable).

```ts
import { ClientError } from '@weave-kit/client';

try {
  await leads.find();
} catch (error) {
  if (error instanceof ClientError && error.code === 'auth.missingKey') {
    // prompt for an API key
  }
}
```

Common codes: `auth.missingKey`/`auth.invalidKey` (401), `rbac.*` (403), `data.recordNotFound`/`data.objectUnknown` (404), `data.field.*`/`http.param.invalid` (400).

## `client.scripts`

Administrator editing of an object's `server.js` lifecycle-hook source:

```ts
const document = await client.scripts.getSource('lead', 'server');
if (document !== null) {
  await client.scripts.save('lead', 'server', document.source, {
    expectVersion: document.version,
  });
}
```

`getSource` returns `{ source, version }` or `null` for a missing file. `save` returns
`{ ok, committed, version }`; changed content is written and committed by the engine. `expectVersion`
is accepted for forward compatibility — the write is last-write-wins. Both reading and writing require
a role listed in the engine's `adapters.rest.adminRoles`.
