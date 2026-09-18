# Getting started

`@weave-kit/client` is a framework-agnostic TypeScript SDK for the WeaveKit engine. No DOM or UI-framework dependencies — it works in browsers, Node, and anywhere a `fetch` implementation exists.

## Install

```sh
npm install @weave-kit/client
```

> Published on npm as [`@weave-kit/client`](https://www.npmjs.com/package/@weave-kit/client).

## Generate object-level types

In your project, compile `schema.json` into typed interfaces:

```sh
weave types   # → generated/types.ts
```

## Create a client

```ts
import { createClient } from '@weave-kit/client';
import type { Lead } from './generated/types';

const client = createClient({
  baseUrl: 'http://localhost:3000',   // engine base URL
  prefix: '/api',                     // optional, defaults to '/api'
  apiKey: 'sk-admin',                 // sent as Authorization: Bearer
});

const leads = client.objects<Lead>('lead');
```

`objects<T>` returns a typed handle — `T` is the object type from `generated/types.ts`. When omitted it defaults to `Record<string, unknown>`.

## CRUD

```ts
// list (filter/sort/fields/limit/offset)
const { rows, total, limit, offset } = await leads.find({
  filter: { status: 'open', score: { gt: 10 } },
  sort: [{ field: 'created_at', direction: 'desc' }],
  fields: ['id', 'title', 'status'],
  limit: 20,
});

// single record — null on 404 (never leaks existence)
const one = await leads.findOne('L1');

// create / update — Partial<T>; defaults may be omitted
const created = await leads.create({ title: 'New lead', status: 'open' });
const updated = await leads.update('L1', { status: 'won' });

// delete
await leads.delete('L1');
```

## Object-level types

`generated/types.ts` derives field types, enum unions, and relation primary-key types from your schema:

```ts
// schema: { "name":"status", "type":"enum", "options":["open","won","lost"] }
lead.status;   // "open" | "won" | "lost" | undefined
```

Run `weave types` again after schema changes (or use `weave dev`, which regenerates on every change).
