# Architecture Diagnostics

This area is for generated and supporting architecture artifacts.

## Dependency Graph (on demand)

- Print latest Mermaid snapshot to stdout with `pnpm arch:deps:mermaid`.
- Generate with `pnpm arch:deps`.
- Validate dependency rules with `pnpm arch:deps:check`.
- Generate machine-readable report with `pnpm arch:deps:json`.
- Output path: `docs/architecture/graphs/dependency-graph.mmd`.
- JSON report path: `docs/architecture/graphs/dependency-report.json`.

Artifacts in `docs/architecture/graphs/` are generated on demand and ignored by default.
