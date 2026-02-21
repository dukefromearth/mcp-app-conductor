# THIS IS WEIRD (and that’s the point)

This repo is a prototype playground for a **shared canvas** that mounts multiple **MCP Apps** (`ui://` views) and coordinates them through a **conductor**. If you’re reading this and thinking “why is this so non‑intuitive?” — good. The weirdness is the product.

The core idea is a hard separation:

- **Humans see pixels.**
- **The conductor sees structured signals.**

And then we build something powerful on top: a chat-driven “pilot” that can operate the entire canvas because it has *complete conductor context* (capabilities, layout, wiring graph, state), while the user watches the UI change live.

This doc is a deliberate attempt to make the weirdness legible.

---

## 0) The one-sentence mental model

Think of this as **VS Code for MCP Apps**:

- multiple independent “extensions” (apps) mounted into panels,
- a host that renders them and enforces boundaries,
- an orchestrator that routes events and automates cross-app workflows,
- and a chat “command deck” that can say: “open that, wire this, run that, explain why.”

---

## 1) Why this exists (what MCP does *not* give you)

MCP standardizes *plumbing*:

- tools/resources/prompts discovery
- calling tools, reading resources
- notifications, progress, cancellation, logging
- (and via MCP Apps) sandboxed UI views that a host can render

MCP does **not** standardize *product semantics* like:

- “what is a DocumentSource?”
- “what does ‘selected text’ mean across apps?”
- “how do multiple apps coordinate as one experience?”
- “how do I swap one module for another without rewriting everything?”

That missing layer is the conductor.

---

## 2) The cast of characters (three surfaces, two worlds)

### Canvas Host (the stage)

The host is a UI runtime. It:

- renders multiple sandboxed `ui://` views (iframes)
- owns layout (mount points: main / sidebar / overlay / pip / fullscreen)
- mediates capability access (which tools/resources are callable, link opening, permissions)
- proxies messages between view ↔ server (AppBridge-style plumbing)

The host is where “rendered Mermaid” lives. Rendering is a host concern.

### MCP App View (the mini-app)

Each view is its own sandboxed UI with its own:

- DOM, storage, and internal state
- UI affordances (select text, press play, scrub timeline, commit transcript)

Views emit **typed events** (messages), and receive **tool results / resource reads / host context**.

### Module Server (the instrument)

Each module is an MCP server that exposes:

- tools (with input/output schemas)
- resources (readable URIs; maybe subscribable)
- prompts (optional)
- and for MCP Apps: `ui://` resources that are the view(s)

### Conductor (the orchestra pit)

The conductor is **host-adjacent logic**. It:

- discovers and inventories module capabilities (tools/resources/prompts + module manifests)
- maintains the **wiring graph** (typed outputs → typed inputs)
- runs an event bus that merges UI events + tool results + resource updates + logs
- writes a **flight recorder** (a causal “why chain” with correlation IDs)

Most importantly: the conductor is **not a renderer**.
It never needs to “look at the screen.” It only needs structured signals.

### Agent Chat (the pilot / command deck)

This is the missing third leg people often forget.

The agent chat is a surface inside the host that:

- accepts high-level intent (“watch Movie A”, “read that paragraph aloud”)
- reads **full conductor context** (what’s mounted, what’s wired, what state is live)
- asks the conductor to perform concrete actions (mount, wire, call tools/resources)
- streams a narrative of what’s happening as events occur

The agent chat is where the experience becomes *infinite*:
you’re no longer clicking UI to assemble a workflow; you’re describing outcomes and watching the system do the mechanical work safely and transparently.

---

## 3) The big split: pixels vs protocol

Here’s the esoteric difference that makes this whole project possible.

### What the user experiences

- “I see a PDF in the main panel.”
- “I highlighted a paragraph.”
- “A little audio player popped into PiP and started speaking.”
- “Subtitles appeared over the video.”
- “When I swapped PDF → video, everything else stayed intact.”

### What the conductor receives/maintains

Not pixels. Signals:

- view lifecycle: mounted/unmounted, display mode, size changes
- UI events: `selectionText`, `play`, `seek`, `commitTranscript`
- module state surfaces: playback position, queue status, current page
- capability inventory: which tools/resources exist *right now*
- wiring edges: `DocumentSource.selectionText -> AudioSink.speak(text)`
- trace data: correlation IDs, logs, progress, cancellation

This is why the conductor can be deterministic and explainable:
it operates on explicit, typed events and contracts, not on “guess what the user meant by looking at the UI.”

---

## 4) Ports, contracts, and the wiring graph (aka “patch-bay physics”)

The conductor’s key artifact is a **wiring graph**.

### Port vocabulary (example archetypes)

These aren’t MCP-standard concepts; they’re a *convention* we use to make modules swappable:

- **DocumentSource** outputs: `selectionText`, `currentPage`, `documentLoaded`
- **MediaSource** outputs: `playbackState`, `playbackTime`, `mediaLoaded`
- **TranscriptStream** outputs: `interimText`, `finalText`, `timing`
- **AudioSink** inputs: `text` (and outputs playback status)

### Wiring = typed routing

A wiring edge is “when this output happens, call that input/tool,” with schema checks:

- When PDF emits `selectionText: string`,
  call Say’s `speak({ text: selectionText })`.

The wiring graph is why this isn’t just “an LLM driving apps”:

- It works even if the model is wrong or offline.
- It is inspectable.
- It is compatible with hot-swap (“replace a source module, keep sinks”).

### Why schemas matter

Schemas are the “voltages” of the patch-bay.

If one module emits `{ text: string; start: number; end: number }`
and another expects `{ content: string }`, that edge should not connect silently.

This repo uses Zod-first contracts for that reason (`packages/contracts/`).

---

## 5) Turns: chat feels discrete, the canvas is continuous

Chat is turn-based. A canvas is event-driven.

The conductor bridges this by treating “turns” as *narrative slices* over a continuous stream:

1. An event occurs (user gesture, server update, timer, subscription tick).
2. The conductor routes it through wiring rules (deterministic edges).
3. The host executes resulting tool calls (capability-gated).
4. New events arrive (results, logs, progress).
5. The agent chat streams an explanation (“what’s happening”) in real time.

So you get the **comfort of chat** (“tell me what you’re doing”)
with the **power of orchestration** (many small actions across apps).

---

## 6) The “watch Movie A” example (the missing magic)

This is the easiest way to feel the concept.

User intent:

> “I want to watch Movie A.”

The agent chat + conductor can do the mechanical work because it “sees” the canvas state.

### What happens (narrative)

```text
User: I want to watch “Movie A”.

Agent: Checking canvas state… no MediaSource mounted.
Agent: Mounting Video module → main…
Agent: Searching catalog for “Movie A”…
Agent: Loading media into the Video view…
Agent: (Optional) Mounting Transcript → overlay and wiring subtitles…

System: Video mounted (main). Playback started.
System: Transcript mounted (overlay). Subtitles live.
```

### What happens (event + action chain)

- Chat intent → conductor creates a new `traceId`
- Conductor checks inventory:
  - Is there a video module connected?
  - Is a video view mounted in `main`?
  - Do we have a “search/catalog” capability?
- Conductor requests host actions:
  - mount `MediaSource` view in `main`
  - call `search` tool with “Movie A”
  - call `load` tool / read `videoUri` resource
  - optionally mount transcript overlay and wire it
- Host executes tool calls and forwards results/events
- Flight recorder logs the causal chain so “why did this happen?” is answerable later

This is why the possibilities feel infinite:
any intent that can be decomposed into (mount + wire + call tools + read resources) can become a live, inspectable workflow.

---

## 7) The flight recorder (your future superpower)

If the conductor is the brain, the **flight recorder** is the memory.

It should be possible to answer questions like:

- “Why did audio start when I highlighted text?”
- “Which module triggered this tool call?”
- “What changed right before the wiring broke?”
- “Why did hot-swap choose Video instead of PDF?”

### A concrete shape (JSONL-ish)

The recorder can be append-only and streamable:

```json
{"t":"...","type":"ui.event","traceId":"T1","source":{"module":"pdf","view":"main"},"name":"selectionText","data":{"text":"..."}}
{"t":"...","type":"wiring.match","traceId":"T1","edge":"DocumentSource.selectionText -> AudioSink.speak(text)"}
{"t":"...","type":"tool.call","traceId":"T1","target":{"module":"say"},"name":"speak","args":{"text":"..."}}
{"t":"...","type":"tool.result","traceId":"T1","target":{"module":"say"},"ok":true}
{"t":"...","type":"ui.state","traceId":"T1","source":{"module":"say","view":"pip"},"name":"playback","data":{"status":"playing"}}
```

If you’ve used Codex/agent tooling, you’ve already seen this pattern:
it’s the same “session log” concept — but for a multi-app canvas.

---

## 8) Capability-gated reality (progressive enhancement or bust)

Everything in MCP is negotiable at runtime. Hosts vary. Modules vary.

So the conductor must treat capabilities as *runtime truth*:

- If a host can’t do PiP, don’t offer PiP.
- If a module doesn’t expose the needed tool, don’t pretend it does.
- If UI embedding isn’t available, fall back to text outputs.

This is not a drawback; it’s how you keep boundaries honest while still composing experiences.

---

## 9) Boundaries and safety (why this isn’t “just a big app”)

Why not merge everything into one UI?

Because the architecture enforces separation:

- each view is sandboxed (no DOM reach-through)
- the host mediates what’s allowed
- the conductor can only act through declared capabilities and wiring rules

This keeps prototypes honest: composition happens through contracts and messages, not through hacks.

---

## 10) What we’re proving (the demo beats)

The proving ground scenarios are the “unit tests” of the concept:

1. **Read + Listen:** PDF selection routes into TTS.
2. **Watch + Subtitles:** video playback routes into transcript overlay.
3. **Hot-swap proof:** swap source modules without rewriting the canvas.
4. **Traceability:** a timeline that makes the system explain itself.

If we can make those four beats feel inevitable, we’ve built the right substrate.

---

## 11) If you’re building on this repo

Start with:

- `README.md` (overview + scenarios)
- `docs/` (deep reference + feature atlas)
- `packages/contracts/` (the “voltage standards”: schemas)

Then build the simplest thing that demonstrates the next beat:

- mount multiple views
- wire one output → one tool call
- show the trace timeline of that cascade

Everything else can evolve.

---

## 12) Stateless baseline, stateful reality

To keep swappability sane, the conductor baseline is **stateless Streamable HTTP**.

That does not mean modules must be stateless forever. It means:

- stateless modules plug in directly
- session modules declare that requirement explicitly
- session modules need an adapter (or they are rejected with a trace reason)

This keeps the canvas deterministic while still allowing richer module behavior later.

---

## 13) Swap tiers (hot, warm, cold)

“Swappable” is not one behavior. It is a policy decision:

- **Hot:** preserve runtime state (`snapshot` + `restore` supported by both modules)
- **Warm:** preserve intent/wiring, reset runtime internals
- **Cold:** remount + rewire with no state carry-over

The conductor always writes the decision chain (`swap.plan`, `swap.fallback`, `swap.applied`) so “why this swap mode?” is answerable from the trace.
