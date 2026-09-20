# @weave-kit/client

> Framework-agnostic TypeScript SDK for the WeaveKit engine.

No DOM or UI-framework dependencies — usable in browsers, Node.js, or anywhere a `fetch`
implementation exists.

## Install

```sh
npm install @weave-kit/client
```

Requires Node.js 24 LTS (for a Node runtime) or any modern browser.

## Usage

```ts
import { createClient } from '@weave-kit/client';
import type { Lead } from './generated/types';

const client = createClient({ baseUrl: 'http://localhost:3000', apiKey: 'sk-admin' });
const leads = client.objects<Lead>('lead');

const result = await leads.find({
  filter: { status: 'open' },
  sort: [{ field: 'created_at', direction: 'desc' }],
  limit: 20,
});
const one = await leads.findOne('L1'); // null on 404 (does not leak existence)
const created = await leads.create({ title: 'New lead' });
const updated = await leads.update('L1', { title: 'Renamed' });
await leads.delete('L1');
```

## Methods

`objects<T>(name)` returns:

- `find(params?)` — `Promise<RestResult<T>>` (`{ rows, total, limit, offset }`)
- `findOne(id, params?)` — `Promise<T | null>` (404 → null)
- `create(data: Partial<T>)` — `Promise<T>`
- `update(id, changes: Partial<T>)` — `Promise<T>`
- `delete(id)` — `Promise<void>`

The client also exposes `metadata`, `permissions`, `audit`, `approvals`, `guardrails`, `identities`,
`layouts`, `schema`, `scripts`, and an SSE `subscribe` for live events.

## Object-level types

`weave types` in your engine project compiles `schema.json` into `generated/types.ts`:

```sh
weave types   # → generated/types.ts
```

```ts
import type { Lead } from './generated/types';
const leads = createClient({ baseUrl, apiKey }).objects<Lead>('lead');
```

Every field type, enum union, and relation's primary-key type is derived from the schema.
`objects<T>` defaults to `Record<string, unknown>` when you omit the type.

## Errors

Non-2xx responses throw `ClientError`:

```ts
import { ClientError } from '@weave-kit/client';

try {
  await leads.find();
} catch (error) {
  if (error instanceof ClientError) {
    error.status; // 401/403/404/400/500
    error.code;   // e.g. 'rbac.denied.read', 'auth.missingKey'
    error.message;
  }
}
```

## Documentation

Full documentation: **[docs.weavekit.io/client](https://docs.weavekit.io/client)**

- [Getting started](https://docs.weavekit.io/client) — setup and first calls
- [API reference](https://docs.weavekit.io/client/api) — every method and option

## Development

```sh
npm install
npm run build        # tsc → dist
npm test
npm run typecheck
npm run lint
```

## License

[MIT](LICENSE)
