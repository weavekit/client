# Changelog

All notable changes to `@weave-kit/client`. Format follows [Keep a Changelog](https://keepachangelog.com/);
the project uses [Semantic Versioning](https://semver.org/).

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
