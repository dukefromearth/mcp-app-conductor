# The Living Doc

Structural refactor date: 2026-02-21

This document is optimized for long-term accuracy under frequent AI-agent edits.
It preserves history and makes staleness visible instead of silently blending old and new claims.

## Doc Contract (anti-stale rules)

1. No timeless "current" claims.
Every mutable statement must be scoped with `As of: YYYY-MM-DD`.

2. Snapshot entries are append-only.
Do not rewrite old snapshots except typo fixes. Add a new snapshot instead.

3. Stable vs volatile separation is mandatory.
- Stable section: architecture invariants, interfaces, schema contracts, source locations.
- Volatile section: capabilities, implemented beats, gaps, diagnostics status.

4. Every volatile claim needs a verifier.
Each claim should map to a path or command in the Source-of-Truth Index.

5. Unknown beats stale fiction.
If not re-verified, write `Unverified` rather than reusing old "now" language.

6. Use explicit recency policy.
- Fresh: snapshot verified within 14 days.
- Aging: 15-30 days.
- Stale: over 30 days.

7. Tasks are a workboard, not a ledger.
Keep `Active Tasks` small. When a task is completed and verified, remove it from `Active Tasks` (to avoid doc bloat) and record the outcome in `Change Log` (and a new Snapshot if it changes volatile facts).

## How To Update (human + agent)

1. Read `THIS-IS-WEIRD.md`, this doc, and `README.md`.
2. Run the verification commands in `Verification Runbook`.
3. Add a new `Snapshot` entry at the top of `Snapshot Ledger`.
4. Carry forward unchanged facts only if still verified.
5. If verification was partial, mark unverified sections explicitly.
6. Add one line to `Change Log` describing what changed and why.
7. Update `Active Tasks` (add new work; remove completed tasks after logging them in `Change Log`).

## Source-of-Truth Index

Use these instead of freehand prose when updating volatile sections.

Area | Canonical source | Verification command
---|---|---
Conductor public API | `packages/conductor/src/index.ts`, `packages/conductor/src/types.ts` | `rg "export|function|type" packages/conductor/src/index.ts packages/conductor/src/types.ts`
Conductor state + wiring + swap + transport | `packages/conductor/src/state/*`, `packages/conductor/src/runtime/*`, `packages/conductor/src/trace/jsonl-recorder.ts` | `rg --files packages/conductor/src/state packages/conductor/src/runtime packages/conductor/src/trace`
Contract Spine schemas | `packages/contracts/src/core.ts`, `packages/contracts/src/artifacts.ts`, `packages/contracts/src/validation.ts`, `packages/contracts/src/runtime-config.ts` | `rg "contractVersion|kind|extensions|z\\." packages/contracts/src`
Canvas host behavior | `packages/canvas-host/src/main.ts`, `packages/canvas-host/src/style.css` | `rg "mount|wire|swap|validation|overlay|strictness|lane|pip|fullscreen" packages/canvas-host/src/main.ts`
CLI command surface | `packages/cli/src/index.ts` | `rg "command\\(|\\.name\\(|probe|dev|connect|wire|swap|doctor|trace" packages/cli/src/index.ts`
Proving-ground scenarios | `examples/proving-ground/scenarios/read-listen.ts`, `examples/proving-ground/scripts/probe-mcp-servers.ts` | `rg "scenario|probe|read-listen|selection|say" examples/proving-ground`
Dependency graph tooling | `tools/dependency-cruiser/depcruise.config.cjs`, `package.json` | `rg "arch:deps|dependency-cruiser|depcruise" tools/dependency-cruiser package.json`

## Stable Architecture Invariants

These are intentionally durable and should only change when architecture changes.

- System model: Canvas Host renders MCP views; Conductor orchestrates typed events/wiring; Modules expose MCP tools/resources/prompts/UI; Contracts define validation and artifact schemas.
- Conductor works on structured signals and event envelopes, not rendered pixels.
- Framing contract: humans operate in pixels; agents reason over conductor-provided structured signals only when user-invoked.
- Interaction model: user can interact with chat and canvas in parallel; agent work is user-initiated (idle until prompt), and invocation hydrates agent context from conductor truth.
- Capability-gated behavior and progressive enhancement are first principles.
- Conductor boundary transport baseline is stateless Streamable HTTP; session modules require a compatible adapter.
- Contract Spine v1 metadata contract is the foundation for manifests, profiles, events, wiring edges, and runtime config artifacts.
- Flight recorder is append-only JSONL for causality and "why chain" traceability.

## Active Tasks (volatile, prune when done)

As of: 2026-02-21

This section is intentionally not a history log.

- Use checkboxes (`- [ ]` / `- [x]`) while work is in-flight.
- When a task is completed and verified, remove it from this list to avoid bloat.
- When removing a completed task, add a `Change Log` entry with what shipped + how it was verified (and a new Snapshot if it changes volatile facts).

- [ ] AT-1: Agent Turn Spine v1 (first-class Agent Turn Runtime)
  - Why: the system has strong contracts + conductor + host primitives, but no canonical runtime boundary for `prompt -> invoke -> hydrate -> act -> trace -> narrate`, which makes agent orchestration feel operationally fragmented.
  - Goal: introduce a provider-agnostic, trace-visible turn spine that is invoked only by a user prompt and executes typed actions through the conductor.
  - Definition of done:
    - A user prompt in host chat runs one full turn through this spine.
    - No direct host heuristics for orchestration outside this path.
    - North-star flow (“read this PDF out loud”) works end-to-end through the agent path with trace visibility.
  - Work items:
    - [ ] Add turn contracts in `packages/contracts`:
      - `agent.turn.requested`
      - `agent.context.hydrated`
      - `agent.action.proposed`
      - `agent.action.executed`
      - `agent.turn.completed`
    - [ ] Add conductor-facing APIs in `packages/conductor`:
      - `hydrateAgentContext({ sinceEventId? })`
      - `executeAgentActions(turnId, actions[])`
      - All outcomes emitted as trace-linked events (turnId + correlation IDs)
    - [ ] Add `packages/agent-runtime` adapter:
      - provider-agnostic interface (no model lock-in)
      - invoked only by user prompt
      - consumes conductor context, emits typed actions + narration
    - [ ] Wire canvas host chat -> agent runtime -> conductor execution (no orchestration heuristics outside this path).
    - [ ] Prove north-star beat end-to-end (“read this PDF out loud”) using the agent turn path, with a trace timeline that answers “why?”.
  - Verifiers:
    - `pnpm build && pnpm typecheck`
    - `node ./packages/cli/dist/index.js doctor`
    - Run (or extend) proving-ground scenario(s) that cover the north-star beat via the agent path.

## Snapshot Ledger (append-only)

### Snapshot: 2026-02-21.a

As of: 2026-02-21
Freshness window: Fresh through 2026-03-07 (14 days)
Verification status: Verified at time of entry

#### System topology at snapshot time

For the latest dependency architecture snapshot (Mermaid to stdout), run:

```bash
pnpm arch:deps:mermaid
```

For persisted graph artifact output, run:

```bash
pnpm arch:deps
```

#### Component status at snapshot time

- `packages/contracts`
: Contract Spine v1 contracts live:
  - `core`: semver `contractVersion` checks (supported major `1`), `kind`, `extensions`
  - `artifacts`: manifests/runtime profiles/module profiles/events/wiring/state schemas
  - `validation`: validation modes, boundaries, policy, issues, outcomes
  - `runtime-config`: `canvas.runtimeConfig` and `canvas.persistedModule` schemas + defaults

- `packages/conductor`
: Runtime API includes:
  - `createConductor(config)`
  - `registerModule(...)`
  - `discoverCapabilities(...)`
  - `mountView(...)`
  - `validateWiringEdge(...)`
  - `connectPorts(...)`
  - `swapModule(...)`
  - `emitPortEvent(...)`
  - `reportValidationOutcome(...)`
  - `subscribe(...)`
  - `getState()` / `getMetrics()` / `getTrace()`
  - `close()`
  - Config accepts `validationPolicy`
  - Events emitted as metadata-rich envelopes (`contractVersion`, `kind`, `extensions`)
  - Wiring edges validated before commit with trace-visible outcomes (`wiring.validate`, `wiring.reject|warn|accept`)
  - High-signal payload schemas enforced via schema map with `validation.outcome` on invalid events

- `packages/canvas-host`
: Browser host supports:
  - multi-server connect (`pdf`, `say`)
  - mount/wire/swap controls
  - lane-based canvas (`main/sidebar/overlay/pip/fullscreen`)
  - AppBridge-based mounted view initialization
  - trace + inventory overlay
  - schema-enforced ingress for mount args and wire inputs
  - host boundary validation outcomes routed into conductor trace
  - validation panel with latest boundary outcomes and trace IDs
  - host-only strictness toggle (`enforce|warn|observe`) for debug/demo workflows

- `packages/cli`
: `mcp-canvas` commands:
  - `probe`
  - `dev`
  - `connect`
  - `wire`
  - `swap`
  - `doctor`
  - `trace`
  - CLI ingress schema-enforced for runtime config, profile JSON, and wiring flags
  - validation failures print normalized JSON outcomes to stderr and exit `1`
  - runtime config auto-migrates legacy shape to v1 and persists atomically
  - migration summaries printed with normalized warnings
  - runtime config writes metadata-rich shape + validation policy

- `examples/proving-ground`
: protocol probe, Contract Spine v1 module profiles, and `scenario:a` (`read-listen`) runner

Agent posture at snapshot time:
- Agent interaction is user-initiated and turn-based (idle between prompts by default).
- The conductor is persistent shared state/memory and deterministic execution substrate for agent turns.
- Agent context is hydrated from conductor state/events/capabilities at invocation time.

#### Transport baseline at snapshot time

- Conductor boundary baseline: stateless Streamable HTTP
- Session-oriented modules rejected unless compatible transport adapter exists
- `say-server` normalized to FastMCP constructor settings:
  - `streamable_http_path='/mcp'`
  - `stateless_http=True`
  - constructor-driven host/port

#### Contract Spine v1 at snapshot time

Contract Spine v1 was intentionally hard-break and forward-looking.

Required metadata:
- `contractVersion` (semver string; supported major `1`)
- `kind` (artifact-specific literal)
- `extensions` (namespaced extension bag)

Artifact kinds:
- `module.manifest`
- `module.runtimeProfile`
- `module.profile`
- `conductor.event`
- `conductor.wiringEdge`
- `canvas.runtimeConfig`
- `canvas.persistedModule`

Boundary validation default policy (hybrid strict):
- `cli.runtimeConfig`: enforce
- `cli.profile`: enforce
- `cli.flags`: enforce
- `host.mountArgs`: enforce
- `host.wireInput`: enforce
- `conductor.wiringEdge`: enforce
- `conductor.eventPayload`: warn
- `conductor.portSignal`: warn

Behavior matrix:
- `enforce`: reject operation
- `warn`: skip invalid dynamic path and emit `validation.outcome`
- `observe`: record-only mode (defined, not defaulted)

Validation outcomes represented as typed `validation.outcome` events where conductor trace is available.

Migration note:
- legacy `.mcp-canvas-runtime.json` auto-migrates on CLI load
- parse as v1 first
- fallback to legacy schema
- transform to Contract Spine v1 shape
- atomically persist migrated config
- continue command execution while printing migration warnings

Profile JSON without required metadata fails at `cli.profile` boundary by design.

Minimum runtime config shape:
- `contractVersion`, `kind`, `extensions`
- `modules`
- `wiring`
- `traceFile`
- `validationPolicy`

#### State model at snapshot time

Canonical state was event-driven and in-memory:
- `modules` (registration + status)
- `capabilityInventory` (tools/resources/prompts)
- `wiring` (typed edges)
- `views` (mounted instances)
- `events` (flight timeline)

Flight recorder: append-only JSONL event envelopes; validation failures may appear as `validation.outcome`.

#### Swap policy matrix at snapshot time

Requested mode | Condition | Resolved mode
---|---|---
`auto` | both modules support snapshot+restore + hot | `hot`
`auto` | no hot but both support warm | `warm`
`auto` | otherwise | `cold`
`hot` | hot unsupported, warm supported | `warm`
`hot` | hot/warm unsupported | `cold`
`warm` | warm unsupported | `cold`

All fallback decisions emitted trace events (`swap.plan`, `swap.fallback`, `swap.applied`).

#### Demo beat implemented at snapshot time

`DocumentSource.selectionText -> AudioSink.speak(text)`

- host receives PDF `updateModelContext`
- adapter extracts `<pdf-selection>...</pdf-selection>`
- conductor emits `port.event` on `pdf:selectionText`
- wiring engine routes to `say:say(text)`
- result traced as tool call/result events

#### Conformance workflow at snapshot time

1. Start ext-app servers (`pdf` on `3001`, `say` on `3002`)
2. Run runtime diagnostics:

```bash
node ./packages/cli/dist/index.js doctor
```

3. Ensure runtime config is v1 shape (legacy files auto-migrate on CLI load)
4. Run CLI probe:

```bash
node ./packages/cli/dist/index.js probe
```

5. Run proving-ground probe:

```bash
pnpm --filter @mcp-app-conductor/proving-ground probe
```

6. Run scenario A:

```bash
pnpm --filter @mcp-app-conductor/proving-ground scenario:a
```

#### Known gaps at snapshot time

- Canvas host mounted views and ran AppBridge, but UX was prototype-grade.
- Swap behavior remapped wiring and traced decision/fallback; deep runtime state migration was not implemented.
- Video/transcript scenarios were planned.
- Event payload typing was hardened for high-signal events, but no full discriminated union for all event classes.
- Runtime diagnostics were CLI-first (`doctor`) and not yet a dedicated host diagnostics workflow.

#### DX tooling at snapshot time

- Dependency architecture graphs generated on demand:
  - config: `tools/dependency-cruiser/depcruise.config.cjs`
  - command (stdout): `pnpm arch:deps:mermaid`
  - command (file): `pnpm arch:deps`
  - output: `docs/architecture/graphs/dependency-graph.mmd` (ignored by default)

## Verification Runbook

Use this before adding a new snapshot.

```bash
# install/build
pnpm install && pnpm build

# type safety
pnpm typecheck

# runtime diagnostics
node ./packages/cli/dist/index.js doctor
node ./packages/cli/dist/index.js probe

# proving-ground checks
pnpm --filter @mcp-app-conductor/proving-ground probe
pnpm --filter @mcp-app-conductor/proving-ground scenario:a

# architecture snapshot (dependency cruiser)
pnpm arch:deps:mermaid
pnpm arch:deps:check
```

## Snapshot Entry Template

Copy for new entries:

```md
### Snapshot: YYYY-MM-DD.<letter>

As of: YYYY-MM-DD
Freshness window: Fresh through YYYY-MM-DD (14 days)
Verification status: Verified | Partially verified | Unverified

#### What changed since previous snapshot
- ...

#### Verified facts
- ...

#### Unverified carry-forward facts
- ...

#### Known gaps
- ...
```

## Change Log

- 2026-02-21: Refactored doc into anti-stale format (rules + source index + append-only snapshots) while preserving prior system content as snapshot `2026-02-21.a`.
- 2026-02-21: Added `Active Tasks` workboard section (checkboxes) and seeded AT-1 (Agent Turn Spine v1) with a “remove-on-complete + log in Change Log” rule.
