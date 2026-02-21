# THIS IS WEIRD (and that's the point)

This repo is a prototype playground for a **shared canvas** that mounts multiple **MCP Apps** (`ui://` views) and coordinates them through a **conductor**.

If your first reaction is "this feels non-intuitive," that is a feature, not a bug.

The weirdness is this hard split:

- **Humans see pixels.**
- **Agents reason over structured signals (when invoked).**
- **The conductor is the baton + score + memory rail.**

Put differently:

- The host renders the stage.
- The conductor keeps the orchestra in time.
- The agent takes the baton only when the user says, "go."

This doc makes that weirdness explicit so readers can reason from first principles, not vibes.

---

## 0) The one-sentence mental model

Think of this as **VS Code for MCP Apps + a prompt-driven pilot**:

- many independent app modules mounted into a shared stage,
- a host that renders and enforces boundaries,
- a conductor that maintains runtime truth and deterministic routing,
- and an agent chat deck that can say: mount this, wire that, run this, explain why.

---

## 0.5) Core interaction law (non-negotiable)

The user is in a dual surface at all times:

- canvas interaction is continuous,
- chat interaction is turn-based.

The conductor runs continuously.

The agent does not.

The agent is **idle until user invocation**. Invocation is the moment context is hydrated from conductor truth (snapshot, deltas, or both), then execution may begin.

Short version:

- **Conductor = persistent shared truth + deterministic execution rail.**
- **Agent = turn-time reasoning and orchestration, user-initiated.**

---

## 0.75) Invocation contract (what must always be true)

1. User prompt starts the agent turn.
2. Agent receives conductor context for that turn.
3. Agent actions go through conductor/host boundaries, never through DOM reach-through.
4. Outcomes are reflected in state and trace.
5. Agent narrates results in user language.

If one of these is missing, we are drifting from the model.

---

## 1) Why this exists (what MCP does not give you)

MCP standardizes protocol plumbing:

- tools/resources/prompts discovery,
- calling tools and reading resources,
- notifications, progress, cancellation, logging,
- and (via MCP Apps) sandboxed UI views hosts can render.

MCP does **not** define product semantics like:

- what `selectionText` means across apps,
- what a reusable `DocumentSource` or `MediaSource` is,
- how cross-app workflows should compose,
- how module swap should preserve intent safely.

That missing semantic layer is the conductor.

The agent uses conductor truth as substrate for user-initiated work.

---

## 2) Cast of characters (three surfaces, two worlds)

### Agent Chat (pilot / command deck)

Primary UX for orchestration intent.

Agent chat:

- accepts user goals ("read this", "watch that", "summarize what changed"),
- is invoked by the user,
- hydrates context from conductor state/events/capabilities,
- requests concrete actions through conductor rails,
- narrates what happened.

Important: this is not default background automation. It is user-initiated, turn by turn.

### Conductor (orchestra pit)

Host-adjacent coordination logic. It:

- inventories module capabilities (tools/resources/prompts + manifests),
- maintains wiring graph (typed outputs -> typed inputs),
- runs event bus across UI events, tool results, resource updates, logs,
- writes flight recorder (causal chain with correlation IDs).

Most importantly:

- conductor is **not** renderer,
- conductor is **not** model intelligence,
- conductor is persistent world model + deterministic execution rail.

### Canvas Host (stage)

UI runtime that:

- renders sandboxed `ui://` views,
- owns layout (main/sidebar/overlay/pip/fullscreen),
- mediates capability gates,
- proxies view <-> server messages.

Host owns pixels. That is its job.

### MCP App View (mini-app)

Sandboxed UI per module with its own DOM/storage/state.

Views emit typed signals and receive updates/tool results/host context.

### Module Server (instrument)

Each module server exposes:

- tools (typed input/output),
- resources (readable/subscribable),
- prompts (optional),
- `ui://` view resources for MCP Apps.

---

## 3) The split that matters: pixels, protocol, and turns

### What the user experiences

- "I see a PDF."
- "I highlighted text."
- "Audio started in PiP."
- "Subtitles appeared over video."

### What the conductor actually sees

Not pixels. Structured signals:

- lifecycle events (mounted/unmounted, mode, size),
- UI events (`selectionText`, `play`, `seek`, `commitTranscript`),
- module state surfaces (page, playback time, queue),
- capability inventory (what is possible right now),
- wiring graph (what is connected to what),
- trace chain (why each action happened).

### What changes on agent invocation

- user prompt begins a turn,
- agent receives hydrated conductor context,
- agent reasons over structured state/capabilities,
- agent requests execution through conductor rails,
- system emits outcomes back into trace/state.

This is why decisions are explainable: contracts and events, not pixel guessing.

---

## 4) Patch-bay physics: ports, contracts, wiring

Wiring graph is the conductor's core artifact.

### Port vocabulary (example archetypes)

These are product conventions (not MCP core primitives):

- **DocumentSource** outputs: `selectionText`, `currentPage`, `documentLoaded`
- **MediaSource** outputs: `playbackState`, `playbackTime`, `mediaLoaded`
- **TranscriptStream** outputs: `interimText`, `finalText`, `timing`
- **AudioSink** inputs: `text` (+ playback status outputs)

### Wiring = typed routing

Example edge:

- PDF emits `selectionText: string`
- route calls Say `speak({ text })`

Why this matters:

- inspectable,
- deterministic,
- swappable without rewriting sinks,
- robust even when model reasoning is imperfect.

### Schemas are voltage standards

If source emits `{ text, start, end }` and sink expects `{ content }`, that edge should fail loudly, not silently coerce.

This repo uses Zod-first contracts (`packages/contracts/`) for exactly this reason.

Agent gap-bridging should happen through composition and explicit transforms, not hidden UI scraping.

---

## 5) Three clocks model (why this feels unusual)

This architecture has three clocks:

1. **Canvas clock**: continuous user interaction and rendering.
2. **Conductor clock**: continuous event/state accumulation.
3. **Agent clock**: discrete user-initiated turns.

Many systems blur these clocks into one loop.

We keep them separate on purpose.

That separation gives us explainability, swappability, and safe orchestration boundaries.

---

## 6) North-star examples (from user perspective)

### Example A: Read this PDF out loud

```text
[CANVAS] User highlights paragraph in PDF.
[SYSTEM] Conductor records selection signal.
[AGENT] Idle.

[USER] Read this out loud.
[AGENT] Invoked. Hydrating conductor context.
[AGENT] PDF selection exists. Speech capability available.
[AGENT ACTION] Use/ensure route: pdf:selectionText -> say:say:text.
[SYSTEM] tool.call -> tool.result.
[AGENT RESPONSE] Reading the selected text now.
```

### Example B: Watch Movie A

```text
[USER] I want to watch Movie A.
[AGENT] Invoked. Fetching capability + layout + module state.
[AGENT] No media source mounted in main.
[AGENT ACTION] Mount video module in main.
[AGENT ACTION] Call search/load capability for Movie A.
[AGENT ACTION] Optional: mount transcript overlay and wire subtitles.
[SYSTEM] mount + tool events stream to trace.
[AGENT RESPONSE] Movie A is loaded and playing.
```

### Example C: Direct canvas interaction, later prompt

```text
[CANVAS] User scrubs timeline.
[SYSTEM] Conductor updates playback state.
[AGENT] Idle.

[USER] Summarize what changed in the last minute.
[AGENT] Invoked. Reads deltas and trace.
[AGENT RESPONSE] Scrubbed 00:42 -> 01:37; captions stayed connected; no swap events.
```

---

## 7) Flight recorder (why this becomes debuggable)

If conductor is coordination memory, flight recorder is causal memory.

It should answer:

- Why did this happen?
- Which module/tool edge triggered it?
- What changed right before failure?
- Why did swap choose warm vs hot?

### Example event chain (JSONL-ish)

```json
{"t":"...","type":"user.prompt.received","traceId":"T1","text":"Read this out loud"}
{"t":"...","type":"conductor.state.hydrated","traceId":"T1","summary":{"modules":2,"edges":1}}
{"t":"...","type":"agent.action.requested","traceId":"T1","action":"tool.call","target":"say:say"}
{"t":"...","type":"tool.call","traceId":"T1","target":{"module":"say"},"name":"say","args":{"text":"..."}}
{"t":"...","type":"tool.result","traceId":"T1","target":{"module":"say"},"ok":true}
{"t":"...","type":"agent.response.sent","traceId":"T1","text":"Reading now"}
```

Canvas events can appear between any of those lines.
Agent execution lines exist only after prompt-driven invocation.

---

## 8) Capability-gated reality (progressive enhancement)

Everything is negotiated at runtime:

- host capabilities vary,
- module capabilities vary,
- transport reality varies.

Conductor must treat capability truth as dynamic fact:

- no PiP support -> do not advertise PiP flow,
- missing tool -> no fake confidence,
- no UI embedding -> degrade to text pathway.

Agent follows same rule: bridge with available capabilities or explain concrete missing capability.

---

## 9) Boundaries and safety (why this is not one giant app)

Architecture guarantees:

- views are sandboxed (no DOM reach-through),
- host mediates access,
- conductor acts through declared capabilities and wiring rules,
- agent executes only on user prompt by default.

This keeps prototypes honest: composition via contracts/messages, not hidden coupling.

---

## 10) Common misreads (and correct readings)

Misread: "The conductor is the agent."

- Correct: conductor is persistent substrate; agent is turn-time reasoner.

Misread: "If conductor is always on, agent is always acting."

- Correct: conductor is always accumulating truth; agent is idle until prompt.

Misread: "The agent watches pixels."

- Correct: the agent reasons over structured signals/context from conductor.

Misread: "This is just chat controlling UI."

- Correct: this is typed, capability-gated orchestration with causal traceability.

---

## 11) What we're proving (demo beats)

0. **User-initiated agency:** prompt starts turn over conductor truth.
1. **Read + Listen:** PDF selection routes to TTS.
2. **Watch + Subtitles:** media playback routes to transcript overlay.
3. **Hot-swap proof:** module swap without canvas rewrite.
4. **Traceability:** timeline explains why each effect happened.

If those beats feel inevitable, substrate is correct.

---

## 12) If you're building in this repo

Start with:

- `README.md` (overview + runbook)
- `THE-LIVING-DOC.md` (snapshot + contracts + status)
- `packages/contracts/` (schema voltage standards)

Then prove the next beat with minimal scope:

- mount multiple views,
- wire one output -> one tool call,
- verify trace chain,
- keep prompt-initiated agent flow explicit in UX.

---

## 13) Stateless baseline, stateful reality

To keep swap semantics sane, conductor baseline is stateless Streamable HTTP.

This does not ban stateful modules forever. It means:

- stateless modules plug in directly,
- session modules must declare requirements,
- session modules need compatible adapters or are rejected with trace reason.

Deterministic core first, richer adapters second.

---

## 14) Swap tiers (hot, warm, cold)

Swap mode is policy, not one behavior:

- **Hot**: preserve runtime state (`snapshot` + `restore` supported on both sides)
- **Warm**: preserve intent/wiring, reset runtime internals
- **Cold**: remount + rewire, no runtime carry-over

Conductor must emit decision chain events (`swap.plan`, `swap.fallback`, `swap.applied`) so mode choice is auditable.

Agent UX should narrate that choice in user language.

---

## 15) Final framing sentence

The product is not "an LLM that clicks buttons."

The product is a shared stage where:

- humans act in pixels,
- conductor maintains machine-readable truth,
- and a user-invoked agent can reliably conduct an expanding orchestra of capabilities.
