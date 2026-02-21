# Schema Design

Status: draft (principles only)
Last updated: 2026-02-21

This document intentionally starts with schema principles only. No implementation plan or API catalog yet.

## Schema Principles

### 1) Signals Over Pixels
Schemas describe what the conductor can know: typed events, capabilities, wiring, and outcomes. They do not describe rendered UI state as source of truth.

Why:
- The host renders pixels.
- The conductor orchestrates structured signals.
- Keeping this boundary clean makes orchestration deterministic and explainable.

Implication:
- Prefer contracts for `selectionText`, `playbackState`, `interimText`, `tool.result`.
- Avoid contracts that depend on DOM layout or visual heuristics.

### 2) Runtime Truth Over Compile-Time Assumption
Every module capability is negotiated at runtime and may vary by host, transport, version, and environment.

Why:
- MCP capabilities are not static.
- Hosts differ in support for display modes and permission surfaces.

Implication:
- Schemas must encode both available and unavailable capability states.
- Contracts should represent degradation paths, not only ideal paths.

### 3) Boundary-First Validation
Validate at system boundaries first: host input, module ingress/egress, CLI config, transport payloads.

Why:
- Most failures begin at boundaries, not deep inside business logic.
- Prototype speed is preserved when internal flow is lightweight and boundary validation is strong.

Implication:
- Parse early, normalize once, propagate typed data.
- Emit traceable validation outcomes instead of silent coercion.

### 4) Contracts Are Product Semantics
MCP gives protocol primitives; our schemas define product meaning.

Why:
- `DocumentSource`, `MediaSource`, `TranscriptStream`, and `AudioSink` are product-level concepts.
- Swappability depends on semantic compatibility, not naming coincidence.

Implication:
- Port contracts must be explicit and typed.
- Wiring compatibility must be evaluated from contracts, not string matching alone.

### 5) Event-Causality Is First-Class
Every meaningful transition must be representable in a typed event envelope with causal context.

Why:
- The flight recorder is a core feature, not debug garnish.
- Users and developers must answer "why did this happen?" quickly.

Implication:
- Require stable identifiers (`eventId`, `traceId`, source metadata, event type).
- Use structured payload variants per event kind.

### 6) Determinism Over Hidden Magic
Schema behavior must be explicit and reproducible, especially in routing and swap decisions.

Why:
- A patch-bay orchestration model fails if behavior is implicit.
- Chat narration depends on deterministic substrate behavior.

Implication:
- Encode policy decisions (for example swap mode resolution and fallbacks) as typed data.
- Make transform steps explicit in edge definitions when data shape changes.

### 7) Progressive Strictness
Validation has modes that can tighten over time: observe, warn, enforce.

Why:
- Prototype phases need fast iteration.
- Scaling phases need stronger guarantees.

Implication:
- Schema design must support policy-driven strictness per boundary and per module class.
- Validation outcomes should be trace events in all modes.

### 8) Additive Evolution By Default
Schema evolution should be additive in minor versions and explicit in breaking versions.

Why:
- Module ecosystems and demos evolve at different speeds.
- Contracts must survive mixed-version environments.

Implication:
- Include `contractVersion` in major artifacts.
- Provide migration contracts for breaking changes.

### 9) Extension Without Fragmentation
Unknown future scenarios are expected; extension must be designed in from day one.

Why:
- New module archetypes, host features, and orchestration patterns will appear.
- Hardcoding a closed model causes repeated redesign.

Implication:
- Reserve namespaced extension fields.
- Preserve unknown extension data through pass-through boundaries.
- Keep core invariants strict while extension space remains open.

### 10) Layered Schema Architecture
Separate core identity, capability, interaction, execution, state, and trace concerns.

Why:
- Holistic design requires clean seams.
- Layering prevents a single monolithic schema from becoming brittle.

Implication:
- Each layer owns clear invariants.
- Cross-layer references happen through stable IDs and typed links.

### 11) Transport-Aware, Transport-Neutral Contracts
Schemas must represent transport constraints without coupling product semantics to one transport implementation.

Why:
- Stateless Streamable HTTP is baseline today.
- Session transport and adapters may be required later.

Implication:
- Runtime profile contracts describe transport requirements and affinity.
- Orchestration contracts remain stable across transport adapters.

### 12) Swap Is Policy, Not Guesswork
Hot, warm, and cold swap behavior must be declared, evaluated, and traced through schema-level policy.

Why:
- Swappability is a core demo beat and future platform promise.
- State migration feasibility differs by module pair.

Implication:
- Encode swap support and fallback reasoning as typed artifacts.
- Represent both requested mode and resolved mode with reasons.

### 13) Human + Agent Readability
Contracts must be equally readable by humans and usable by automation.

Why:
- This system is operated through both UI control surfaces and agent command surfaces.
- Debugging speed depends on legible contracts.

Implication:
- Prefer concise, predictable object shapes and stable naming.
- Avoid schema cleverness that reduces operational clarity.

### 14) Prototype Honesty
Prototype scope can be small, but schema claims must be honest.

Why:
- False guarantees create architectural debt and misleading demos.
- Honest contracts allow incremental hardening without rewrites.

Implication:
- Model only what is actually supported.
- Represent unsupported states explicitly instead of silently accepting them.

## Contract Spine v1 Defaults

Current default posture for this repo:

- Compatibility: hard break for non-metadata contract artifacts.
- Versioning: semver `contractVersion` with supported major `1`.
- Validation policy: hybrid strict.
  - static ingress boundaries (`cli.*`, `host.*`) enforce
  - dynamic runtime boundary (`conductor.portSignal`) warn

These defaults are foundation choices for scaling, and can be tightened or relaxed per boundary through explicit policy contracts.
