# @weave-kit/client — architecture notes

## Positioning (hard constraint)

`@weave-kit/client` is the **framework-agnostic TypeScript SDK** — the public interface layer of the
headless engine. **It must not import React/Vue/Svelte or any framework code.** Users initialize it
with `createClient({ baseUrl, apiKey })` and use it directly.

## Directory structure

```
src/
├── client.ts       # createClient entry + ClientOptions + Client + setApiKey (runtime key swap)
├── objects.ts      # object-level generic CRUD: objects<Lead>('lead').find/findOne/create/update/
│                   # delete + updateMany/deleteMany (atomic batch); optional signal passthrough
├── http.ts         # fetch adapter + URL/query building + ClientError
├── types.ts        # FindParams/FindSort/FindOneParams (reusing engine contract types)
├── metadata.ts     # client.metadata.{list,get} + client.permissions()
├── audit.ts        # client.audit.query() (generic `filter` JSON; ts/actor_id/action/object/
│                   # is_error columns + date range)
├── approvals.ts    # client.approvals.list/approve/reject (approval queue, admin)
├── guardrails.ts   # client.guardrails.list/getSource/history/save (guardrail policy source)
├── identities.ts   # client.identities.list (identity directory, admin read)
├── subscribe.ts    # client.subscribe (live events: fetch SSE stream + auto-reconnect + replay)
├── layouts.ts      # client.layouts.getSource(addr)/save/list/create/rename/delete/saveDesign
│                   # (page layout source, path-mirrored addressing)
├── schema.ts       # client.schema.getSource/save (object raw schema source + version; admin)
├── scripts.ts      # unified getSource/save (object-level server/show/list source, version + Git commit)
└── index.ts        # re-exports
tests/
├── client.test.ts           # mock-fetch unit tests
├── client-accessors.test.ts # metadata/permissions/audit accessors
├── subscribe.test.ts        # SSE stream parsing / reconnect / 401 / close
├── scripts.test.ts          # client.scripts.getSource/save: JSON source / 404→null / error mapping
└── e2e/client.e2e.test.ts   # real engine + listen + fetch E2E
```

## Key conventions

- Dependency direction: `client` depends on the engine's API contract and shared types but **does not
  import the engine implementation**; contract types use **type-only imports**
  (`import type { RestResult, Filter, SortDir, ApiErrorBody } from '@weave-kit/engine'`, zero runtime
  import)
- `createClient({ baseUrl, prefix?, apiKey?, fetch? })`: `prefix` defaults to `/api`; `fetch?` is
  injectable (test mock / custom transport), defaulting to global fetch; the baseUrl trailing slash
  is normalized
- **Object-level generic `objects<T>(name)`**: `objects<Lead>('lead')`; `ObjectsClient<T>` methods
  return `T` directly (`find(): Promise<RestResult<T>>`, `findOne(id): Promise<T | null>`,
  `create(data: Partial<T>)`, `update(id, changes: Partial<T>)`, `delete(id)`); **findOne 404 → null**;
  DELETE→204, create→201; `T` defaults to `Record<string, unknown>`
- **Object-level type loop**: `weave types` generates `generated/types.ts` (the engine's
  `generateObjectTypes`; the field→TS mapping is documented in the engine repo's
  [`docs/06-weave-cli.md`](https://github.com/weavekit/engine/blob/main/docs/06-weave-cli.md)) → the
  user does `import type { Lead } from './generated/types'` → `objects<Lead>('lead')`; `weave dev`
  regenerates on hot reload
- Serialization matches the REST contract: `filter=JSON.stringify`, `sort=field:direction,...`,
  `fields=a,b`, `limit/offset` numbers; `FindParams` reuses the engine's `Filter`/`SortDir`
- Non-2xx → `ClientError { status, code, message, params? }` (parses the uniform error body, falling
  back to `http.internal`); auth = `Authorization: Bearer <apiKey>`
- Dependency: `@weave-kit/engine` is a **dependency** (contract types); `.env.example` is a
  placeholder and a local `.env` (for E2E) is gitignored
- Pure TS, no runtime framework dependency, no DOM dependency (must run in Node)
- **Unified script API**: `scripts.getSource(name, kind, { signal? })` → `{ source, version } | null`,
  `scripts.save(name, kind, source, { expectVersion?, signal? })` → `{ ok, committed, version,
  warnings? }`; kind reuses the engine's `ScriptSourceKind`
