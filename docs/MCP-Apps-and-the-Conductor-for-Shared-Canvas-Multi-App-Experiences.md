# MCP Apps and the Conductor for Shared-Canvas Multi-App Experiences

**Title:** MCP Apps + Conductor/Coordinator for Shared-Canvas Multi-App Experiences  
**Audience:** Principal Architects, Principal Engineers, Head of Product  
**Date-of-truth:** Feb 19, 2026 (America/New_York)  
**Scope:** Research baseline + capability inventory + implications for a conductor. Implementation “how” is intentionally deferred, except for demo-relevant constraints and realities. citeturn8search26turn11search1turn4view0turn2view0

**Freshness policy:** MCP and MCP Apps are moving quickly; wherever host behavior is “host-dependent” or a feature is described as “experimental / evolving,” treat any secondary writeups as advisory and anchor decisions in the official docs/spec and the actively-maintained repositories’ issues/PRs. citeturn13search13turn4view0turn6view0turn19search0

---

## Executive summary

A “shared canvas” experience becomes compelling when multiple interactive MCP Apps coexist and cooperate: one view renders, another listens, a third narrates, and the conductor stitches them into a single user-perceived instrument panel (rather than a pile of widgets). MCP Apps makes “interactive UI inline with the conversation” a standardized capability (HTML UI resources + tool linkage + bidirectional JSON-RPC over `postMessage`), while core MCP provides the coordination primitives (capability negotiation, tools/resources/prompts, subscriptions, progress/cancellation, logging, sampling, elicitation). citeturn4view0turn6view0turn11search5turn8search1turn8search3turn8search0turn0search20

The conductor is the precursor because MCP does **not** standardize product semantics for “how apps compose,” only the protocol by which each app exposes resources/tools and communicates with hosts. Put differently: MCP gives us the electrical standard and safe plugs; the conductor is the power strip plus circuit breaker plus patch-bay label maker. This is why the conductor’s key artifact should be **input/output contracts** (ports) that make modules swappable without rewriting the canvas. MCP’s tool `inputSchema`, optional `outputSchema`, and `CallToolResult.structuredContent` give us the raw material for typed ports, but the port vocabulary is a product-level convention. citeturn14view1turn14view3turn13search3turn6view0turn12view2

For an internal MVP demo vehicle, the fastest high-signal path is to repurpose existing MCP Apps examples from the official `ext-apps` repository (e.g., PDF viewer, streaming TTS, video-via-resource, transcript). These already demonstrate critical “canvas-grade” behaviors: chunked loading, UI-only tools, streaming tool inputs, view lifecycle messages, host theming, and sandbox patterns. citeturn2view1turn2view2turn3view0turn18view0turn18view1turn2view0

What we know with high confidence:
- MCP Apps is published as a **stable** extension spec (2026-01-26) with explicit protocol methods for view lifecycle, tool input/result streaming, host context, display modes, and sandbox guidance. citeturn2view0turn6view0turn7view2
- Core MCP (latest public revision in official docs) defines robust coordination utilities: dynamic tool/resource discovery with list-change notifications, resource subscriptions (`resources/subscribe` → `notifications/resources/updated`), structured logging, progress tokens, and cancellation. citeturn14view1turn12view1turn8search1turn8search2turn8search3
- The `ext-apps` SDK explicitly targets three distinct developer roles—app dev, host dev, server author—and ships an `App Bridge` package plus a reference `basic-host` example capable of connecting to multiple servers via configuration. citeturn2view0turn4view0turn18view1

What we must deliberately validate (and show in the demo):
- Multi-server, multi-view orchestration feels like one cohesive experience: one user gesture yields coordinated results across apps, with a “why did this happen?” trace surface. citeturn8search1turn6view0turn18view1
- Swappability works in practice: replace a “DocumentSource” module (PDF) with a “MediaSource” module (video), keep the rest intact, and rewire via contracts. (This is the conductor’s moment to glow.) citeturn2view1turn3view0turn6view0turn12view2

---

## What’s real as of Feb 2026

### Core MCP baseline and stability signals

MCP’s official docs describe a versioning scheme using `YYYY-MM-DD` identifiers, where versions indicate the last date backwards-incompatible changes were made. citeturn8search26turn11search1

In the current “latest” spec revision presented in official docs (2025-11-25), MCP includes:
- A JSON-RPC 2.0 base protocol, lifecycle management (with capability negotiation), transports, and optional utilities. citeturn13search5turn11search1turn11search11
- Servers exposing tools/resources/prompts; clients optionally providing sampling, roots, elicitation; both sides can use utilities like logging, progress, and cancellation where supported. citeturn13search5turn16view0turn8search1turn8search2turn8search3turn0search20

A practical conductor implication: many “coordination luxuries” (tasks, advanced sampling features) are capability-gated and may not be universally supported; the conductor should treat capabilities as a runtime truth, not compile-time certainty. citeturn15search10turn16view0turn8search6turn8search0

### Transport realities relevant to a canvas

Official docs distinguish stdio and Streamable HTTP; Streamable HTTP includes session handling with an `MCP-Session-Id` header and explicit rules for reuse, failure, and restart. citeturn1search10turn8search28

For an internal demo, stdio is attractive for “run locally, no tunnel,” while Streamable HTTP is a closer analog to “distributed canvas + multiple remote servers.” Importantly, MCP Apps UI ↔ host communication is **not** stdio/HTTP; it is JSON-RPC over `postMessage` between iframes and the host, with the host proxying selected MCP requests to servers. citeturn6view0turn4view0turn18view1turn1search10

### MCP Apps: current spec and ecosystem signals

The official `ext-apps` repository defines MCP Apps as interactive UIs for MCP tools that render inline in compliant hosts, and explicitly labels 2026-01-26 as the **stable** spec revision. citeturn2view0turn6view0

The MCP Apps docs summarize the canonical pattern:
- A tool declares `_meta.ui.resourceUri` pointing to a `ui://` resource.
- Hosts can preload the UI resource, render it in a sandboxed iframe, and communicate bidirectionally with a JSON-RPC dialect (`ui/*` plus a subset of core MCP calls). citeturn4view0turn6view0

Host support (as stated in the official MCP Apps documentation) includes several major clients (e.g., Claude web/Desktop, VS Code Insiders, Goose, Postman, and others), with the caveat that “support varies” and hosts may instantiate either a framework-based renderer or AppBridge-based integration. citeturn4view0turn0search25

The `ext-apps` SDK surface area is explicitly partitioned:
- `@modelcontextprotocol/ext-apps` for building views (App class, postMessage transport),
- `@modelcontextprotocol/ext-apps/react` for React hooks,
- `@modelcontextprotocol/ext-apps/app-bridge` for host embedding/rendering/tool proxying,
- `@modelcontextprotocol/ext-apps/server` for registering tool metadata and UI resources.  
The repository also notes there is **no supported host implementation** beyond the included reference example (`examples/basic-host`). citeturn2view0turn18view1

### Extensions negotiation: mature concept, messy edges

Official docs describe an “extensions” mechanism negotiated in the initialization handshake via a `capabilities.extensions` object, and present MCP Apps (`io.modelcontextprotocol/ui`) as an official extension that uses this. citeturn17view0turn7view4turn6view0

However, the official core schema for 2025-11-25 shows `ClientCapabilities` with an `experimental` field and **does not** include an `extensions` field in the typed interface. citeturn16view0

This mismatch is not theoretical: maintainers and SDK users have opened issues noting that MCP Apps’ proposed `capabilities.extensions` field is not represented in some SDK types, complicating implementation of MCP Apps capability negotiation. citeturn0search12turn15search2turn16view0

Conductor relevance: if the conductor is intended to be a reusable substrate across hosts/SDKs, it must not assume a single canonical representation of extension capabilities without a compatibility strategy.

---

## Shared canvas and conductor primitives

### Shared canvas definition rooted in the spec

A “canvas” (for our purposes) is a host runtime that can mount multiple views concurrently, persist their identities, and manage their lifecycles as first-class UI surfaces rather than ephemeral tool output. MCP Apps supplies lifecycle building blocks: a `ui/initialize` handshake, `ui/notifications/initialized`, `ui/notifications/size-changed`, host context updates (`ui/notifications/host-context-changed`), and teardown (`ui/resource-teardown`). citeturn7view2turn7view3turn6view0

The spec also formalizes display modes (`inline`, `fullscreen`, `pip`) and container sizing semantics that a canvas can use to implement panels, overlays, and responsive layouts. citeturn6view0turn7view2

For web hosts, the spec recommends (and the reference host implements) a double-iframe “sandbox proxy” pattern: an outer proxy on a different origin plus an inner iframe that loads raw HTML with CSP enforcement and sandbox restrictions, with bidirectional message relay. citeturn6view0turn18view1

### Where the conductor sits conceptually

MCP is designed so that cross-server interactions are controlled by the host, with capability negotiation establishing what’s allowed in a session. citeturn15search10turn11search1turn11search11

In a shared canvas, the conductor is best understood as **host-adjacent logic** that:
- Maintains an inventory of connected servers, installed apps, and mounted views.
- Maps outputs from one module (e.g., “selected text”) into inputs for another module (e.g., “speak this”), while staying inside MCP’s capability and isolation boundaries.
- Provides a deterministic “wiring graph” so multi-app composition remains correct even if an LLM is absent, wrong, or offline.

This is not a spec-defined component; it is an architectural pattern that becomes necessary once you want composable multi-app experiences with swappability.

### Why “new view per tool call” matters to conductor design

The current MCP Apps MVP assumes view instances are created per tool call (simplifying lifecycle), and community discussion is already exploring “re-usable views” and alternative host layouts (e.g., persistent side panels) as future evolution. citeturn19search1turn7view4

Conductor implication: treat “view identity” and “view persistence” as **explicit** design choices in the conductor (with clear semantics and fallbacks), because the ecosystem is not yet converged on one universal behavior. citeturn19search1turn19search0turn7view4

---

## MCP Apps capabilities and implications for orchestration

### The canonical Tool + UI Resource pattern

MCP Apps standardizes interactive UI delivery by:
- Requiring UI resources to use a `ui://` URI scheme and (in MVP) `text/html;profile=mcp-app`.
- Linking tools to UI resources via `_meta.ui.resourceUri`.
- Allowing hosts to preload and render these resources in a sandboxed iframe, then push tool input/results to the UI over JSON-RPC. citeturn6view0turn4view0turn7view4turn2view0

The spec rationale explicitly chooses **predeclared resources** referenced from tool metadata (rather than embedding UI content in tool results) for host prefetching, caching, template review, and alignment with existing MCP resource discovery patterns. citeturn7view4turn6view0

This matters to the conductor because it creates a stable “module surface”: a conductor can reason about installed UI templates and tool surfaces before any user action occurs.

### Bidirectional communication methods the conductor can lean on

The Apps spec defines:
- Host → view notifications for full tool arguments (`ui/notifications/tool-input`), optional partial tool arguments during streaming (`ui/notifications/tool-input-partial`), tool results (`ui/notifications/tool-result`), and cancellations (`ui/notifications/tool-cancelled`). citeturn7view2turn6view0
- View → host requests for “open a link” (`ui/open-link`), “send a chat message” (`ui/message`), “change display mode” (`ui/request-display-mode`), and “update model context” (`ui/update-model-context`). citeturn7view0turn6view0turn18view0
- View sizing and host context updates (`ui/notifications/size-changed`, `ui/notifications/host-context-changed`) enabling responsive multi-view layout. citeturn7view2turn6view0

A conductor that wants reactive multi-app orchestration can treat these as event sources alongside core MCP notifications.

### Tool visibility as a first-class orchestration primitive

The Apps spec introduces `_meta.ui.visibility` to control which tools are callable by the model vs. by the UI, with `"app"` scope restricted to the same server connection and explicit host enforcement requirements. citeturn6view0turn7view4

This is not just a security feature; it’s an orchestration feature. It enables servers to expose “UI plumbing” tools (polling queues, refresh buttons, chunk loaders) without polluting the model’s tool space. The PDF Server demonstrates this with an app-only chunk streaming tool, and the Say Server demonstrates multiple UI-only queue tools while keeping only the top-level “say” tool model-visible. citeturn2view1turn2view2turn6view0

For the conductor, `visibility` can become an important line between:
- **Public ports** (model + conductor can invoke), and
- **Private implementation details** (only the view invokes).

### Structured tool outputs and keeping the model on a diet

Core MCP’s `CallToolResult` includes both `content` (unstructured) and optional `structuredContent` (structured JSON). citeturn13search3turn14view3

The core tools spec advises that for backwards compatibility, tools returning `structuredContent` should also return a serialized JSON representation inside a text content block. citeturn14view3

The MCP Apps spec further recommends treating:
- `content` as the text representation suitable for model context and text-only hosts,
- `structuredContent` as UI-optimized rendering data (not meant to be added to model context),
- `_meta` as auxiliary metadata not intended for model context. citeturn7view3turn13search3

This is orchestration gold: the conductor can route rich structured payloads across apps without stuffing the conversational context window, while still keeping a human-readable “shadow” in `content` for traceability.

### Theming and host context as a cohesion mechanism

MCP Apps defines host-provided context including theme (`light`/`dark`), standardized CSS variables, optional font CSS, container dimensions, platform hints, and locale/timezone. citeturn6view0turn7view0

The PDF Server example explicitly demonstrates view theming reacting to host context changes and syncing with the host’s theme and style variables. citeturn2view1turn6view0

In a shared canvas, the conductor can use host context and display modes not merely for aesthetics, but to implement choreography: e.g., “when speech starts, pop the transcript view into PiP; when the user expands the document, collapse PiP.”

---

## Core MCP features the conductor can exploit

### Discovery, dynamism, and subscriptions

Core MCP supports dynamic discovery and runtime changes through list methods and list-change notifications:
- Tools: servers can declare `tools.listChanged` and emit `notifications/tools/list_changed` when tool lists change. citeturn14view1turn1search2turn1search0
- Resources: servers can declare `resources.subscribe` and/or `resources.listChanged`, emit `notifications/resources/list_changed`, and send `notifications/resources/updated` for subscribed resources. citeturn12view1turn12view2turn1search1
- Prompts: servers can declare prompt list changes similarly. citeturn1search7

For conductor design, this implies a natural event-driven backbone: a capability-driven registry plus a unified event bus that merges tool list changes, resource updates, logs, and UI events.

Reality check: not every client responds correctly to these notifications today; there are reported interoperability issues where a client fails to refresh tool lists after `notifications/tools/list_changed`. citeturn1search9turn14view1

### Progress, cancellation, and durable operations

MCP defines progress notifications via `notifications/progress` keyed by a `progressToken`, with requirements about token validity and task-augmented behavior. citeturn8search2turn13search3

Cancellation is defined via `notifications/cancelled` for in-progress requests, with special rules for task-augmented requests (use `tasks/cancel` instead). citeturn8search3turn8search6turn13search3

Tasks exist in the 2025-11-25 spec but are explicitly considered experimental and may evolve. citeturn8search6turn13search13

Conductor implication: for an MVP demo, progress/cancel can be treated as the “good citizen” layer that makes multi-app orchestration feel alive (spinners that mean something, interruptibility that saves time), while tasks should be treated as “optional upgrade path” unless host support is confirmed at runtime. citeturn8search2turn8search3turn8search6

### Logging and traceability as a UI feature

MCP defines a standardized logging system where clients can set minimum log levels and servers send structured log notifications with severity and arbitrary JSON-serializable data. citeturn8search1turn13search3

The schema enumerates logging severity levels aligned to syslog levels, which supports consistent “flight recorder” UIs across modules. citeturn9view0

For the conductor, this suggests a pattern: every cross-app action should be correlatable to a log chain (server logs + host logs + view logs), turning “explain this” into a native user-visible affordance rather than an afterthought. citeturn8search1turn6view0turn18view1

### Human-in-the-loop primitives: elicitation and sampling

Elicitation allows servers to request structured user input via the client, including form mode and URL mode; URL mode is explicitly called out as new and subject to change. citeturn0search20turn16view0

Sampling allows servers to request model generation via the client (client-controlled model access), and in 2025-11-25 sampling also supports tool-enabled flows where servers pass tool definitions and tool choice configuration, enabling agentic loops under the client’s control. citeturn8search0turn15search14turn16view0

For conduction, elicitation is your “ask the user one crisp question” primitive, and sampling is your “let the model improvise a melody, but keep it on-sheet-music” primitive. Both are powerful but must be surfaced as capability-gated features, because not all clients will implement all modes. citeturn0search20turn16view0turn8search0

### Schema as the hidden hand behind swappability

Tools use JSON Schema for `inputSchema`, may supply an `outputSchema`, and can include `structuredContent` in results, enabling typed coordination. citeturn14view1turn14view3turn13search3

However, this is also an area of real-world fragility: there are reports of certain clients dropping tool lists when encountering tool metadata fields such as `outputSchema`, `title`, or tool annotations, implying uneven adoption across the ecosystem. citeturn13search15turn14view1

Conductor implication: treat schema richness as a negotiated luxury and consider “schema downshifts” (e.g., stripping `outputSchema` for a given host) as a pragmatic compatibility tactic for demos that must run across multiple clients. citeturn13search15turn14view3

---

## Contracts for swappable MCP Apps

### Why contracts are required even with MCP

MCP standardizes _how_ tools/resources/prompts are described and invoked; it does not standardize _what a “selection,” “transcript,” or “media stream” means_ across independent apps. The resources spec explicitly notes that user interaction models are application-driven and not mandated by the protocol, and that custom URI schemes are permitted. citeturn11search0turn12view0turn12view2

So, if we want “swap PDF viewer for video viewer” without rewriting orchestration, we need a thin convention layer: port contracts that define the semantics of app outputs and inputs.

### A minimal contract surface that maps cleanly onto MCP

A practical swappability convention can be built from existing MCP primitives:

- **Module manifest resource**: a `resources/read`-able document that declares the module’s identity, version, and its ports (inputs/outputs), with JSON Schemas for each port. This is simply a resource with a stable URI and structured JSON. citeturn12view1turn13search3
- **Port invocation tools**: tools that accept “input port payloads” using `inputSchema` and produce “output port payloads” via `structuredContent` (and optionally an `outputSchema`). citeturn14view1turn14view3turn13search3
- **State surface**: a subscribable resource that represents current module state (e.g., current page, playback timestamp), allowing the conductor to react without scraping UI. citeturn12view1turn12view2
- **Visibility enforcement**: internal tools can be declared app-only with `_meta.ui.visibility: ["app"]`, keeping port surfaces clean. citeturn6view0turn2view1turn2view2

This is “using what exists to invent what doesn’t”: you’re not changing MCP, you’re standardizing your product’s grammar on top of it.

### Concrete port examples grounded in ext-apps demos

A whimsical-but-useful baseline vocabulary could include:

- **DocumentSource**: outputs “document loaded,” “current page,” and “selected text.” The PDF Server already updates model context with current page content and demonstrates view persistence and display mode changes, making it a natural DocumentSource. citeturn2view1turn7view0
- **MediaSource**: outputs “media loaded,” “playback state,” and provides resource URIs for binary media (via base64 blob resource pattern). The Video Resource Server demonstrates a tool returning a `videoUri` that the view fetches via `resources/read`. citeturn3view0turn12view1turn13search3
- **TranscriptStream**: outputs interim and final transcription text, plus timing. The Transcript Server streams interim text to model context via `ui/update-model-context` and can send completed transcripts via `ui/message`. citeturn18view0turn7view0
- **AudioSink (TTS)**: inputs text, outputs audio chunks / playback status. The Say Server demonstrates streaming behavior, partial tool inputs (`ontoolinputpartial`), and UI-only queue tools. citeturn2view2turn7view2turn6view0

With these contracts, the conductor can wire:
- DocumentSource.selectedText → AudioSink.text
- MediaSource.playbackTime → TranscriptStream.offset (if supported)
- TranscriptStream.interimText → a subtitle overlay module or model context stream (depending on capability and desired UX) citeturn18view0turn7view0turn6view0

---

## Demo vehicle as a Conductor proving ground

### Why reuse ext-apps examples for the MVP demo

The official `ext-apps` repository was built specifically to demonstrate real-world use cases and provides runnable examples plus a reference host (`basic-host`). It is optimized for proving UI+tool patterns, not for showcasing domain-specific embedding engines. citeturn2view0turn4view0turn18view1

The demo vehicle goal is therefore not “build a bespoke cinematic interface,” but “prove the conductor makes multi-app composition feel inevitable.”

### Candidate modules for a one-month build

The following are already demo-ready and cover the conductor’s essential surface area:

- PDF Server: chunked data transfer patterns, model context updates, display modes, theming, view persistence, and app-only tools. citeturn2view1turn6view0
- Say Server: streaming TTS, partial tool inputs, private tools, CSP metadata requirements, and multi-view coordination (speak lock). citeturn2view2turn6view0
- Video Resource Server: binary resources via base64 blob pattern and resource-read flow from UI. citeturn3view0turn13search3
- Transcript Server: live transcription, `ui/update-model-context`, and permission metadata (`microphone`). citeturn18view0turn6view0
- Basic Host: reference multi-server host configuration via `SERVERS`, iframe management, and sandbox proxy implementation details. citeturn18view1turn2view0turn6view0

### Demo scenarios mapped to conductor capabilities

Scenario A: “Read + Listen”  
A user opens a PDF view, selects a paragraph, and it is spoken aloud with synchronized highlighting. PDF demonstrates model context updates and UI event surfaces; Say demonstrates streaming input and UI-only tools. The conductor’s job is to route selection → speech requests and keep state coherent across views. citeturn2view1turn2view2turn6view0

Scenario B: “Watch + Subtitles”  
Swap the DocumentSource (PDF) for a MediaSource (video). Add TranscriptStream as a subtitle provider. The conductor mounts a subtitle overlay view (or uses a transcript view) and routes streaming transcription into either the overlay or model context (depending on UX). citeturn3view0turn18view0turn7view0turn6view0

Scenario C: “Hot-swap proof”  
Live swap of modules while maintaining the rest of the canvas and wiring via contracts. This is not an MCP feature; it is a conductor capability that uses MCP’s discovery and capability negotiation to verify compatibility before rewire. citeturn11search11turn15search10turn14view1turn12view1

Scenario D: “Traceability timeline”  
Show a timeline that correlates user actions, UI events (`ui/message`, `ui/update-model-context`), server tool calls, and structured logs. MCP’s logging utility and Apps’ defined UI<->host message types provide the substrate for this “why did the system do that?” panel. citeturn8search1turn7view0turn6view0turn18view1

---

## Confidence gaps and open questions

### Extensions negotiation mismatch

Official docs and MCP Apps spec describe negotiation via `capabilities.extensions` during initialization. citeturn17view0turn7view4turn6view0

Yet the 2025-11-25 core schema for `ClientCapabilities` does not include an `extensions` field and instead provides `experimental` plus an explicit statement that capabilities are not a closed set. citeturn16view0

This has already manifested as practical SDK friction (e.g., issues noting typed SDKs can’t express `extensions`, and suggestions to use `experimental` instead). Confidence is moderate on “the ecosystem will converge soon,” but low on “which shape is universally implemented today.” citeturn0search12turn15search2turn16view0

### View persistence and UI-only state: demanded, not yet standardized

Community requests explicitly ask for ChatGPT-like UI widget state persistence (including a distinction between model-visible vs private UI state) as a missing primitive in MCP Apps. citeturn20view0turn0search19

The spec itself lists state persistence and view-to-view communication as future/advanced features rather than MVP guarantees. citeturn7view4

Open issue traffic also indicates active exploration of reusable views, TUIs, accessibility, and view semantics—useful signals that conductor/platform teams should treat these as evolving targets. citeturn19search0turn19search1

### Host variability is a feature, but it complicates composition

MCP Apps emphasizes that hosts can restrict what apps can do (e.g., which tools can be called, whether link opening is permitted), and host behavior drives sandbox enforcement. This is core to safety, but it means conductor logic must be capability-adaptive and should degrade gracefully. citeturn4view0turn6view0

For an internal prototype running in a controlled environment, we can simplify policy decisions—but the conductor’s architecture should still model “capability gates” explicitly, because those gates are fundamental to MCP’s design. citeturn15search10turn11search11turn6view0

### Interop fragility in emerging fields

Some clients appear to have rough edges with newer tool metadata (e.g., `outputSchema` / annotations), potentially causing tool list parsing failures and tool disappearance. This is a critical reality for any orchestrator that expects typed tool contracts to be universally safe. citeturn13search15turn14view3

Similarly, even long-standing spec features like `notifications/tools/list_changed` can be inconsistently handled across clients, reinforcing the need for conductor-level robustness patterns (periodic reconciliation, defensive refresh). citeturn1search9turn14view1

### What we’re confident MCP provides vs what conductor must supply

High confidence MCP provides:
- The protocol for discovery, invocation, and reactive updates (tools/resources + notifications + subscriptions). citeturn14view1turn12view1turn12view2
- UI embedding and bidirectional UI↔host communication for interactive views (MCP Apps). citeturn6view0turn4view0turn18view1
- Run-control and observability primitives (progress, cancellation, logging). citeturn8search2turn8search3turn8search1

High confidence the conductor must supply:
- Cross-app semantic contracts (ports) and the wiring graph; MCP does not define product-level meaning. citeturn11search0turn14view1turn13search3
- A state ledger that survives app swaps and view lifecycle variability (because persistence is not standardized in MCP Apps MVP). citeturn7view4turn19search1turn20view0
- A trace UI that correlates events across servers and views into a coherent narrative (MCP gives logs and message types; “coherent narrative” is a product decision). citeturn8search1turn7view0turn18view1