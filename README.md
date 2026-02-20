# `mcp-canvas-conductor`

A TypeScript toolkit for building a **shared canvas** that mounts **multiple MCP Apps** (interactive `ui://` Views) and coordinates them through a **conductor** (orchestrator).

This repo is optimized for **internal prototyping**: fast iteration, rich “composability demos,” and clear boundaries between **canvas**, **conductor**, and **modules**—without committing to the final production “how” yet.

> MCP Apps are interactive HTML interfaces that render inside MCP hosts and communicate via a `postMessage`-based dialect of MCP; hosts render them in a sandboxed iframe and mediate tool access. ([Model Context Protocol][1])

---

## What you get

### Conductor runtime (the “orchestra pit”)

* **Capability discovery + inventory** for tools/resources/prompts (and change reconciliation when lists change).
* **Module registry** driven by a minimal **manifest** convention (ports + mountable views + state surfaces).
* **Wiring graph**: connect module outputs → module inputs with schema-checked contracts.
* **Event bus**: unify UI events, tool results, resource updates, logs, progress/cancel.
* **Flight recorder**: correlation IDs + trace timeline so you can answer “why did the canvas do that?”

### Canvas host scaffolding (the “stage”)

* Multi-view compositor with **mount points** (main, sidebar, overlay, PiP/fullscreen if supported).
* Integrates MCP Apps embedding via **AppBridge** (iframe sandbox + message plumbing + tool proxying). ([modelcontextprotocol.github.io][2])
* A “patch-bay” debug overlay that shows mounted modules and live wiring.

### Demo harness (“Conductor Proving Ground”)

Composable scenarios using upstream MCP Apps examples (PDF + Say + Video + Transcript) to prove:

* swappable modules (PDF ↔ Video)
* coordinated behaviors (read → speak, watch → subtitles)
* traceability (event + tool-call timeline)

> ext-apps includes a reference `basic-host` example and explicitly notes there’s no supported host implementation beyond examples—hosts either use MCP-UI or roll their own. ([modelcontextprotocol.github.io][3])

---

## Non-goals (by design)

* Production authentication, hardened authorization, multi-tenant sandbox policy tuning
* High-scale performance work (owned by other teams)
* Choosing the final conductor architecture (rules vs plan graph vs hybrid). This library supports exploration.

---

## Prerequisites

* Node.js **18+** (recommended for MCP Apps workflows). ([Model Context Protocol][1])
* A host environment capable of rendering MCP Apps (this repo provides a dev host scaffold using AppBridge). ([Model Context Protocol][1])

---

## Installation

### As a library (workspace / internal registry)

```bash
pnpm add mcp-canvas-conductor
# or
npm install mcp-canvas-conductor
```

### For dev (recommended monorepo layout)

```bash
pnpm install
pnpm build
```

---

## Repository layout

```text
packages/
  conductor/           # conductor runtime, registries, wiring graph, trace ledger
  canvas-host/         # shared canvas host, view compositor, patch-bay UI
  contracts/           # manifest schema + port contract helpers (zod/json-schema)
  cli/                 # `mcp-canvas` CLI (run host, run scenarios)
examples/
  proving-ground/      # demo scenarios composed from upstream ext-apps examples
  modules/             # optional local demo modules (thin wrappers)
docs/
  MCP-Apps-and-the-Conductor-for-Shared-Canvas-Multi-App-Experiences.md
  Shared-Canvas-Conductor-Reference:-MCP-Apps-and-Core-MCP-Primitives.md
```

---

## Docs

See [`./docs`](./docs) for design context and implementation references:

- [`MCP-Apps-and-the-Conductor-for-Shared-Canvas-Multi-App-Experiences.md`](./docs/MCP-Apps-and-the-Conductor-for-Shared-Canvas-Multi-App-Experiences.md): Product-oriented overview of the shared-canvas/conductor concept, goals, architecture, and demo scenarios.
- [`Shared-Canvas-Conductor-Reference:-MCP-Apps-and-Core-MCP-Primitives.md`](./docs/Shared-Canvas-Conductor-Reference:-MCP-Apps-and-Core-MCP-Primitives.md): Technical reference mapping conductor patterns to MCP Apps and core MCP primitives, with protocol-level implementation notes.

---

## Core concepts

### Canvas

A host runtime that:

* renders multiple MCP App Views (sandboxed iframes)
* exposes mount points + layout
* mediates tool access to servers (via AppBridge)

> MCP Apps run in a sandboxed iframe; the host controls which capabilities an app can access (e.g., which tools an app can call). ([Model Context Protocol][1])

### Conductor

A coordination runtime that:

* discovers what each module can do (tools/resources + module manifest)
* keeps an inventory of mounted views and state surfaces
* wires module ports together
* maintains a traceable causal chain of actions

### Module (MCP App server)

A server that exposes:

* **Tools** and **Resources** (core MCP) ([GitHub][4])
* a UI View via MCP Apps: tool metadata references a `ui://` resource that the host renders ([modelcontextprotocol.github.io][5])

---

## High-level architecture

```mermaid
flowchart LR
  subgraph Host["Shared Canvas Host"]
    V["View Compositor<br/>mount points + layout"]
    B["AppBridge embedding<br/>sandboxed iframes + postMessage"]
  end

  subgraph Conductor["Conductor Runtime"]
    R["Registry<br/>tools/resources + module manifests"]
    W["Wiring Graph<br/>ports: outputs -> inputs"]
    E["Event Bus + Trace Ledger"]
  end

  subgraph Modules["MCP App Modules (servers)"]
    M1["PDF Module<br/>DocumentSource"]
    M2["Say Module<br/>AudioSink"]
    M3["Video Module<br/>MediaSource"]
    M4["Transcript Module<br/>TranscriptStream"]
  end

  Host <--> Conductor
  Conductor <--> Modules
  Host <--> Modules
```

---

## Quick start: run the proving ground demo

### 1) Start upstream example modules (ext-apps)

This demo vehicle intentionally reuses upstream example servers so you can focus on coordination.

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps
npm install

# in separate terminals
cd examples/pdf-server && npm start
cd examples/say-server && npm start
cd examples/video-resource-server && npm start
cd examples/transcript-server && npm start
```

The upstream examples exercise real MCP Apps behaviors such as tool→UI binding (`_meta.ui.resourceUri`) and host rendering in a sandboxed iframe. ([Model Context Protocol][1])

### 2) Start the canvas host + conductor

```bash
pnpm --filter canvas-host dev
# or
pnpm mcp-canvas dev
```

### 3) Connect modules (stdio or HTTP)

```bash
pnpm mcp-canvas connect --server pdf=http://localhost:3001/mcp
pnpm mcp-canvas connect --server say=http://localhost:3002/mcp
pnpm mcp-canvas connect --server video=http://localhost:3003/mcp
pnpm mcp-canvas connect --server transcript=http://localhost:3004/mcp
```

> The MCP TypeScript SDK supports stdio and Streamable HTTP transports and includes runnable examples for both servers and clients. ([GitHub][4])

---

## Demo scenarios

### Scenario A: Read + Listen (PDF → Say)

**User-visible result:** highlight text in the PDF view → audio plays in the Say view.

Conductor wiring:

* `DocumentSource.selectionText` → `AudioSink.speak(text)`

```ts
import { createConductor } from "mcp-canvas-conductor/conductor";
import { z } from "zod";

const conductor = await createConductor({
  servers: [
    { id: "pdf", url: "http://localhost:3001/mcp" },
    { id: "say", url: "http://localhost:3002/mcp" },
  ],
});

await conductor.mount({ moduleId: "pdf", mountPoint: "main" });
await conductor.mount({ moduleId: "say", mountPoint: "pip" });

await conductor.connectPorts({
  from: { moduleId: "pdf", port: "selectionText", schema: z.string() },
  to:   { moduleId: "say", tool: "speak", arg: "text", schema: z.string() },
});
```

Why this pattern:

* selection is UI-native, not model-native; MCP Apps let Views update model context or send UI messages, but the conductor can route the signal directly without requiring the model to “notice” every highlight. ([Model Context Protocol][1])

### Scenario B: Watch + Subtitles (Video + Transcript)

**User-visible result:** video plays; live transcript overlays subtitles.

Conductor wiring:

* `TranscriptStream.interim` → `SubtitleOverlay.render(interim)`
* `TranscriptStream.final` → `SubtitleOverlay.commit(final)`

### Scenario C: Hot-swap proof (PDF ↔ Video)

**User-visible result:** swap DocumentSource for MediaSource without rewriting the rest of the canvas.

Conductor behavior:

* detach wiring edges that depend on `DocumentSource`
* attach wiring edges that match `MediaSource`
* keep sink modules (Say, SubtitleOverlay) intact

---

## Module contract (the “ports” convention)

MCP standardizes protocol primitives; it does **not** standardize “what a PDF module is.” This repo adds a minimal convention:

### Required: `module.manifest` resource

Each module implements a resource (example URI shown) that declares:

* module identity (`id`, `version`, `displayName`)
* mountable views (`ui://…` resources + supported display modes)
* ports (typed outputs) and accepted inputs
* optional state resources to subscribe to

This convention is intentionally lightweight so you can wrap existing servers without deep refactors.

---

## Why this library leans on MCP Apps primitives

MCP Apps provide:

* a standardized **Tool + UI Resource** pattern (`_meta.ui.resourceUri`) ([modelcontextprotocol.github.io][5])
* a sandboxed iframe execution model with host-mediated capability control ([Model Context Protocol][1])
* SDK components for app developers, server authors, and host developers (AppBridge) ([modelcontextprotocol.github.io][3])

The conductor uses these to make “multi-app on one canvas” feel like a single, coherent instrument panel rather than a pile of iframes.

---

## Development notes

### Zod + schema validation

The MCP TypeScript SDK uses Zod for schema validation; keep module contracts and port schemas Zod-first when possible. ([GitHub][4])

### Transports

* Prefer Streamable HTTP for remote or multi-process dev stacks.
* Use stdio for local “spawned tool” modules.

(Your demo can mix both.)

---

## Safety (prototype posture)

Even internal demos benefit from the MCP Apps sandbox model because it prevents accidental coupling between modules and the host UI (DOM/storage isolation and host-mediated capabilities). ([Model Context Protocol][1])
This repo does not aim to be “production hardened,” but it tries to keep the **boundaries honest**.

---

## References (primary sources)

* MCP Apps guide (concepts, sandbox model, host support notes). ([Model Context Protocol][1])
* ext-apps SDK + roles + “no supported host beyond examples” statement. ([modelcontextprotocol.github.io][3])
* AppBridge module API surface (embedding, protocol versions). ([modelcontextprotocol.github.io][2])
* MCP TypeScript SDK (tools/resources/prompts, transports, examples). ([GitHub][4])
* MCP Apps Quickstart (Tool + Resource registration pattern). ([modelcontextprotocol.github.io][5])

[1]: https://modelcontextprotocol.io/docs/extensions/apps?utm_source=chatgpt.com "MCP Apps - Model Context Protocol"
[2]: https://modelcontextprotocol.github.io/ext-apps/api/modules/app-bridge.html?utm_source=chatgpt.com "app-bridge | @modelcontextprotocol/ext-apps - v1.0.1"
[3]: https://modelcontextprotocol.github.io/ext-apps/api/?utm_source=chatgpt.com "@modelcontextprotocol/ext-apps - v1.0.1"
[4]: https://github.com/modelcontextprotocol/typescript-sdk?utm_source=chatgpt.com "GitHub - modelcontextprotocol/typescript-sdk: The official TypeScript SDK for Model Context Protocol servers and clients"
[5]: https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html?utm_source=chatgpt.com "Quickstart | @modelcontextprotocol/ext-apps - v1.0.1"
