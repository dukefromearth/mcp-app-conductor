# Dependency Cruiser

This folder owns dependency graph tooling and policy config.

## Config

- `depcruise.config.cjs`: central dependency-cruiser rules and options.
- `../../tsconfig.depcruise.json`: analysis-only TypeScript config used by dependency-cruiser for workspace alias resolution.

## Commands

From repo root:

- `pnpm arch:deps`
  - Generates collapsed Mermaid dependency graph on demand at `docs/architecture/graphs/dependency-graph.mmd`.
- `pnpm arch:deps:mermaid`
  - Prints collapsed Mermaid dependency graph to stdout (best for agent in-memory consumption).
- `pnpm arch:deps:check`
  - Runs rule validation (no graph output).
- `pnpm arch:deps:json`
  - Generates machine-readable dependency report at `docs/architecture/graphs/dependency-report.json`.

## Why this location

Keeping tooling config in `tools/` keeps repo root focused on entry docs and runtime controls, while preserving a clear place for architecture diagnostics.
