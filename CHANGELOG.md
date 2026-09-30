# Changelog

All notable changes to `@weave-kit/client`. Format follows [Keep a Changelog](https://keepachangelog.com/);
the project uses [Semantic Versioning](https://semver.org/).

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
