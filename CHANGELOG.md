# Changelog

All notable changes to `@weave-kit/client`. Format follows [Keep a Changelog](https://keepachangelog.com/);
the project uses [Semantic Versioning](https://semver.org/).

## [2.3.0]

### Added

- `ClientOptions.locale` / `Client.setLocale()` — sends `Accept-Language` on REST and SSE requests.
  Pass a getter to follow runtime language switches without recreating the client.
- `derive()` preserves the locale and accepts a per-derivation override.

## [2.2.0]

### Added

- `ApprovalsClient.vote(key, { decision, comment? })` and `votes(key)`.
- Approval filters support `pendingFor` / `expiresBefore`; decision results expose
  `approvedCount` / `requiredApprovals`.

## [2.1.0]

### Added

- `ApprovalsClient.approve` / `reject` accept `{ comment? }`; approval filters support
  `requestedBy` / `approvalKey`.
- Re-exports the extended `PendingApproval` contract fields.

## [1.1.1]

Works with `@weave-kit/engine@^1.5.0`.

### Changed

- **`@weave-kit/engine` is now an optional peer dependency** (`peerDependenciesMeta`). The client only
  uses engine **types** (type-only import), so front-end projects no longer get the whole server
  runtime pulled in by npm's automatic peer install (fastify, pg, esbuild, tsx, pgsql-parser). The
  peer/dev range is bumped to `^1.5.0`.
- `FindParams.total` (`'exact' | 'estimate' | 'none'`) is serialized to the REST `total` query param
  so a caller can opt out of / estimate the server-side row count.

## [1.1.0]

Works with `@weave-kit/engine@^1.3.0`. Requires Node 22+.

### Removed

- **`layouts` client retired.** `client.layouts.*` (`getSource` / `save` / `list` / `create` /
  `rename` / `delete` / `saveDesign`), `layoutPagePath`, and the page/layout types (`SourceDocument`,
  `PageSummary`, the `*Page*` / `*Design*` / `*Layout*` option/result types, and the re-exported
  `LayoutAddress` / `ObjectLayoutView` / `PageRef`) are removed. The engine retired the layout format
  and the `@weave-kit/engine/layout` export (2026-10) — it is headless and emits no UI — so this
  release realigns the client with `@weave-kit/engine@^1.3.0`.

### Changed

- `@weave-kit/engine` peer dependency range is `^1.3.0`.

## [1.0.0]

Works with `@weave-kit/engine@1.0.0`. Requires Node 22+.

### Changed

- `@weave-kit/engine` peer dependency range is `^1.0.0`. No client API changes — aligns with the
  engine's **G1 contract-freeze** (1.0) release.

## [0.11.0]

Works with `@weave-kit/engine@0.11.0`. Requires Node 22+.

### Changed

- `@weave-kit/engine` peer dependency range is `^0.11.0`. No client API changes — tracks the engine
  (Agent Execution pipeline + Evidence).

## [0.10.0]

Works with `@weave-kit/engine@0.10.0`. Requires Node 22+.

### Changed

- `@weave-kit/engine` peer dependency range is `^0.10.0`. No client API changes — tracks the engine
  (QueryBudget).

## [0.9.0]

Works with `@weave-kit/engine@0.9.0`. Requires Node 22+.

### Changed

- `@weave-kit/engine` peer dependency range is `^0.9.0`. No client API changes — this release tracks
  the engine (schema revisions / atomic deploy, audit modes, cursor pagination, explicit access
  principal).

## [0.8.0]

Works with `@weave-kit/engine@0.8.0`. Requires Node 22+.

### Changed

- `@weave-kit/engine` peer dependency range is `^0.8.0`. No client API changes — this release tracks
  the engine (GraphQL adapter, named enums / schema v6).

## [0.7.0]

Works with `@weave-kit/engine@0.7.0`. Requires Node 22+.

### Changed

- Requires Node 22+ (was Node 24).
- `@weave-kit/engine` peer dependency range is `^0.7.0`.

## [0.6.0]

Works with `@weave-kit/engine@0.6.0`. The engine is now a **peer dependency** (this SDK uses engine
types only), so install it alongside the client.

### Added

- **Workflow accessor** — read an object's workflow state and fire transitions from the SDK.
- `record.transitioned` is now a typed live event and carries the workflow definition identity.

### Changed

- Identity summaries carry `departmentId`, matching the engine's `department` row scope.
- Types track the engine's record-id change: a record's id is its `record_key` (the `weave_id`
  field), not the raw primary key.

### Breaking

- `@weave-kit/engine` moved from `dependencies` to `peerDependencies` (`^0.6.0`). Install
  `@weave-kit/engine@0.6.0` next to the client.
