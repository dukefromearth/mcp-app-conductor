MCP Apps Feature Atlas for Shared-Canvas Coordination
=====================================================

**Date-of-truth:** Feb 19, 2026 (America/New_York)\
**Audience:** Principal Architects, Principal Engineers, Head of Product\
**Purpose:** A citation-backed reference for **all MCP Apps features** (and the core MCP primitives they lean on) that teams may need to build a **shared canvas + coordinator/conductor** and a compelling internal demo.

* * * * *

1) What MCP Apps are, in one mental model
-----------------------------------------

MCP Apps extend the "tool returns content" pattern by letting a tool declare a **UI resource** (a `ui://...` HTML app) in its tool metadata; the host fetches and renders that UI inside the conversation and proxies bidirectional messages between the UI and the server. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

One of many uses of **MCP Apps**, may be to render a **PDF viewer** or **interactive dashboard** inline so a user can pan/zoom/click without leaving the chat context. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

* * * * *

2) Capability negotiation and "progressive enhancement"
-------------------------------------------------------

### 2.1 Core idea: extension negotiation

MCP extensions are optional; clients/servers advertise support during the initialization handshake in a `capabilities.extensions` map (e.g., `io.modelcontextprotocol/ui` with supported MIME types). ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

One of many uses of **extension negotiation**, may be to let the conductor **feature-gate** UI composition: if the host doesn't support MCP Apps, the same tools still work, but the canvas falls back to text. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

### 2.2 Graceful degradation requirement

If only one side supports an extension, the supporting side should fall back to core behavior or reject if mandatory; UI-enhanced tools should still return meaningful text for non-UI clients. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

**Conductor implication:** design every "port contract" so it has a **text-only shadow** (even if the UI path is richer), because graceful degradation is explicitly expected. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

* * * * *

3) Tool ↔ UI binding: the "UI lives in tool metadata" pattern
-------------------------------------------------------------

### 3.1 `_meta.ui.resourceUri`

A tool can declare `_meta.ui.resourceUri` pointing at a `ui://` resource; hosts may preload/cache it before tool execution. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

One of many uses of **UI preloading**, may be to enable **streaming tool inputs** to the view (the host can load the UI and start sending partial arguments while the model is still generating). ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

### 3.2 Deprecation: `_meta["ui/resourceUri"]`

The Apps spec notes a deprecated flat `_meta["ui/resourceUri"]` form; `_meta.ui.resourceUri` is the target shape. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **noting deprecations**, may be to keep the conductor's compatibility layer tolerant: accept both forms when discovering UI resources, but emit telemetry so modules can be upgraded. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

* * * * *

4) Tool visibility: "app-only" tools as an orchestration primitive
------------------------------------------------------------------

The Apps spec introduces `_meta.ui.visibility` with `"model"` and `"app"`; app-only tools must be hidden from the agent tool list and blocked cross-server. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **`visibility: ["app"]`**, may be to expose "plumbing" tools (chunk fetch, queue polling, refresh) that only the UI calls, keeping the model's tool surface clean. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

**Demo relevance:**

-   PDF server uses an app-only chunk tool (`read_pdf_bytes`) to stream large PDFs. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   Say server uses app-only tools for queue-based streaming and hides them from the model. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/say-server/README.md "raw.githubusercontent.com"))

* * * * *

5) UI resources: what they are, how they're delivered
-----------------------------------------------------

### 5.1 `ui://` scheme + MIME type

MCP Apps standardize UI resources declared via `ui://...`; in the initial MVP, the spec expects HTML with `text/html;profile=mcp-app`. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **standardized MIME typing**, may be to allow the host/conductor to **validate renderability** ("I can render this UI modality") before mounting a view. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

### 5.2 CSP metadata: `_meta.ui.csp`

UI resources can declare CSP needs (connect domains, resource domains, frame domains, base-uri domains); hosts use this to enforce appropriate CSP headers. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

One of many uses of **`connectDomains`**, may be to allow a UI to open a websocket to a realtime service while still keeping a host-controlled allowlist. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 5.3 Permissions metadata: `_meta.ui.permissions`

UI resources may request sandbox permissions (camera/microphone/geolocation/clipboard); hosts may honor them via iframe `allow` attributes; apps should not assume they're granted and should use feature detection. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

One of many uses of **microphone permission**, may be to power a live transcription UI while the conductor routes transcript output to another module (subtitles, summaries, voice-driven commands). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/transcript-server/README.md "raw.githubusercontent.com"))

### 5.4 Why predeclared resources (vs inline UI blobs)

The Apps spec explicitly chose "predeclared resources referenced in tool metadata" for performance (preload), security (review), caching (static template separate from dynamic data), and auditability. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **separating template from data**, may be to let the conductor "hot-swap" modules without re-downloading UI shells, while only swapping structured payloads across ports. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

* * * * *

6) Sandbox and security model (even for internal demos)
-------------------------------------------------------

### 6.1 Host-rendered sandboxed iframe + postMessage

The MCP docs describe MCP Apps running in a sandboxed iframe; the sandbox prevents access to parent DOM/cookies/storage and routes all communication through `postMessage`, with the host controlling which capabilities the app can access. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

One of many uses of **host capability control**, may be to disable `openLink` or restrict which tools an app can call---important for a shared canvas where untrusted modules may exist even internally. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

### 6.2 Double-iframe "sandbox proxy" pattern (reference host)

The `basic-host` example uses a double-iframe sandbox: the outer iframe runs on a separate origin and relays messages, and the inner iframe receives HTML via `srcdoc` with sandbox restrictions. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/basic-host/README.md "raw.githubusercontent.com"))

One of many uses of the **sandbox proxy**, may be to let the conductor mount multiple independent app views without granting them any direct access to the host canvas DOM. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/basic-host/README.md "raw.githubusercontent.com"))

* * * * *

7) SDK surface area (what exists "off the shelf")
-------------------------------------------------

### 7.1 The SDK roles and packages

The official ext-apps docs describe distinct roles and packages:

-   `@modelcontextprotocol/ext-apps` (Views: `App`, `PostMessageTransport`)

-   `@modelcontextprotocol/ext-apps/react` (React hooks)

-   `@modelcontextprotocol/ext-apps/app-bridge` (host embedding/proxying)

-   `@modelcontextprotocol/ext-apps/server` (server helpers for registering tools/resources with UI metadata) ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/ "@modelcontextprotocol/ext-apps - v1.0.1"))

One of many uses of **AppBridge**, may be to accelerate the shared canvas host: iframe lifecycle, tool proxying, and visibility checks are already represented in the host SDK module surface. ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/modules/app-bridge.html "app-bridge | @modelcontextprotocol/ext-apps - v1.0.1"))

### 7.2 React helpers

The React module includes hooks such as `useApp`, `useHostStyleVariables`, `useHostFonts`, `useDocumentTheme`, and `useAutoResize` (rarely needed) and notes the core SDK is framework-agnostic. ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/modules/_modelcontextprotocol_ext-apps_react.html "@modelcontextprotocol/ext-apps/react | @modelcontextprotocol/ext-apps - v1.0.1"))

One of many uses of **`useHostStyleVariables`**, may be to ensure every mounted module inherits the host's theme consistently so the canvas feels like one instrument panel. ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/modules/_modelcontextprotocol_ext-apps_react.html "@modelcontextprotocol/ext-apps/react | @modelcontextprotocol/ext-apps - v1.0.1"))

### 7.3 Reference host reality

The API docs state there is no supported host implementation beyond `examples/basic-host`; clients may use MCP-UI (`@mcp-ui/client`) or roll their own, and host support varies. ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/ "@modelcontextprotocol/ext-apps - v1.0.1"))

**Conductor implication:** your canvas host is a product---and AppBridge is a toolkit, not a turnkey host. ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/ "@modelcontextprotocol/ext-apps - v1.0.1"))

* * * * *

8) MCP Apps protocol dialect: "UI ↔ Host" messages you can depend on
--------------------------------------------------------------------

### 8.1 Transport and shared subset of MCP messages

MCP Apps use JSON-RPC 2.0 over `postMessage` for iframe↔host communication. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))\
UI iframes can use a subset of standard MCP messages like `tools/call`, `resources/read`, `notifications/message`, and `ping`. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **`resources/read` from a View**, may be to fetch a binary video blob by URI after a tool returns a `videoUri`. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.2 Handshake: `ui/initialize` and capabilities exchange

The Apps spec defines a handshake (`ui/initialize` → `ui/notifications/initialized`) and has the view provide `appCapabilities`, including supported display modes and whether the app supports `tools/list_changed` notifications. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **view capabilities**, may be to let the conductor decide whether a module can be mounted in PiP or fullscreen before offering those layout controls. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.3 Host context: the conductor's "stage lighting"

The host can provide a `hostContext` in `McpUiInitializeResult` including: toolInfo (tool metadata + originating tools/call id), theme, styles (CSS variables and font CSS), display mode, container dimensions, locale/timezone, platform hints, device capabilities, and safe area insets. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **`toolInfo`**, may be to let a module render "this UI is the view for tool X, invoked with request id Y," which is essential for conductor traceability and debugging. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.4 Host capabilities: what the host promises the view

The spec defines `HostCapabilities` in the `ui/initialize` response (e.g., openLinks, serverTools, serverResources, logging, sandbox permissions/CSP allowlists). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **host openLinks capability**, may be to enable an attribution popup's "open source" button---if the host allows it. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.5 Sizing: `ui/notifications/size-changed` + container dimensions

When a host uses flexible dimensions, it must listen for `ui/notifications/size-changed` and resize the iframe accordingly; views should send size changes (e.g., via ResizeObserver). The SDK default `autoResize` behavior is described as enabled by default and debounced. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **auto-resize**, may be to let a PDF view expand while a transcript view shrinks, without the conductor needing hardcoded CSS for every module. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.6 Display modes: inline / fullscreen / pip

Views declare supported display modes in `appCapabilities.availableDisplayModes`; hosts declare supported modes in `HostContext.availableDisplayModes`. Views request changes with `ui/request-display-mode`, and hosts notify changes via `ui/notifications/host-context-changed`. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **PiP mode**, may be to keep a TTS karaoke view floating while the user scrolls a PDF. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.7 Tool input streaming: partial → complete

Hosts may send `ui/notifications/tool-input-partial` zero or more times (best-effort recovered JSON) before sending `ui/notifications/tool-input` with complete args; views may ignore partials and must not rely on them for critical operations. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **partial tool inputs**, may be to start playing TTS audio while the model is still generating the tail end of the text. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/say-server/README.md "raw.githubusercontent.com"))

### 8.8 Tool results and structured payloads

Tool execution results are delivered to the view via `ui/notifications/tool-result` and are the standard `CallToolResult` type. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))\
The Apps spec recommends: `content` for text/model, `structuredContent` for UI rendering, `_meta` for auxiliary metadata. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **`structuredContent`**, may be to pass a transcript stream's structured timing data to a subtitle overlay module without bloating the model context. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.9 Tool cancellation

The lifecycle diagram includes `ui/notifications/tool-cancelled` to notify views that a tool was cancelled. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **tool-cancelled**, may be to stop playback and clear buffers when the conductor swaps a module mid-interaction. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.10 `ui/resource-teardown` (host-initiated cleanup)

Hosts must send `ui/resource-teardown` before tearing down the UI resource; the host may provide a reason and should wait for a response to avoid data loss. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **resource teardown**, may be to allow a view to persist state (e.g., scroll position) before the conductor unmounts it. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 8.11 `ui/open-link`

Views can ask the host to open an external URL via `ui/open-link`; the host may deny (policy/invalid URL). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **open-link**, may be to let a PDF title click open the original arXiv page via the host's browser controls. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

### 8.12 `ui/update-model-context`

Views can send "model context" updates; each update overwrites prior view-sent context; hosts should provide context to the model in future turns and may defer until the next user message (including `ui/message`). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **update-model-context**, may be to keep the model aware of the "current page" in a PDF viewer so the user can ask "what does this paragraph imply?" without manually copying text. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

### 8.13 `ui/message`

The Apps spec sequence diagram shows `ui/message` as a path that triggers host follow-ups; it is distinct from logging (`notifications/message`) and context updates. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

One of many uses of **ui/message**, may be "Send transcript to host" (a user-driven commit action) that triggers downstream orchestration (summarize, translate, or route to a note-taking module). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/transcript-server/README.md "raw.githubusercontent.com"))

* * * * *

9) Core MCP primitives MCP Apps lean on (critical for the conductor)
--------------------------------------------------------------------

### 9.1 Tools discovery and dynamism

Servers declare `tools.listChanged`; they can emit `notifications/tools/list_changed` when tool lists change. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))\
Tool definitions include `name`, optional `title`, `inputSchema`, optional `outputSchema`, and optional icons. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

One of many uses of **tools/list_changed**, may be for a module to "install" additional app-only tools after initialization, with the conductor reconciling inventories. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

### 9.2 Resources subscriptions

Servers can declare `resources.subscribe` and emit `notifications/resources/updated` for subscribed resources. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/resources "Resources - Model Context Protocol"))

One of many uses of **resource subscriptions**, may be to keep a "live status" module in sync without polling, while the conductor routes those updates to other modules. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/resources "Resources - Model Context Protocol"))

### 9.3 Structured logging (and why the conductor should care)

Servers send structured logs via `notifications/message`; clients can set a minimum log level with `logging/setLevel`. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging "Logging - Model Context Protocol"))

One of many uses of **structured logs**, may be to power a conductor "flight recorder" timeline that correlates cross-app tool calls and UI events for explainability/debug. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging "Logging - Model Context Protocol"))

### 9.4 Structured results: `structuredContent` + `outputSchema`

Tools can return `structuredContent`; for backward compatibility they should also include serialized JSON in `content`. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))\
Tools may provide `outputSchema`; if provided, servers must conform and clients should validate. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

One of many uses of **outputSchema**, may be to formalize conductor port contracts so swapping modules is a schema match instead of a best-effort guess. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

### 9.5 Streamable HTTP sessions (server↔host plumbing)

For Streamable HTTP, servers may assign `MCP-Session-Id` during initialization; clients must include it on subsequent requests, and must restart sessions on HTTP 404. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports "Transports - Model Context Protocol"))

One of many uses of **MCP sessions**, may be to let the conductor treat each server connection as a durable "instrument channel" with predictable restart semantics. ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports "Transports - Model Context Protocol"))

* * * * *

10) Reference demo modules (ext-apps examples) and the features they prove
--------------------------------------------------------------------------

### 10.1 PDF Server (DocumentSource archetype)

Demonstrates:

-   Chunked data via size-limited tool calls (range requests + `hasMore/offset`) ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   `app.updateModelContext` for "current page content" ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   Display modes + `requestDisplayMode` and handling mode changes ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   `openLink` ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   View persistence via `viewUUID` + localStorage (example-level pattern, not a spec guarantee) ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

-   Theming via host context + CSS variables/light-dark ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

One of many uses of the **PDF chunking pattern**, may be to handle host tool-payload size limits while still delivering large documents into an interactive experience. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

### 10.2 Say Server (AudioSink archetype)

The Say server explicitly lists features demonstrated: partial tool inputs, queue-based streaming, model context updates for playback progress, theming, fullscreen mode, multi-view speak lock via localStorage, hidden tools (`visibility: ["app"]`), openLink, and CSP metadata domains for in-browser transpilation. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/say-server/README.md "raw.githubusercontent.com"))

One of many uses of the **queue streaming pattern**, may be to decouple "model generates text" from "UI consumes audio chunks" while letting the conductor orchestrate playback across modules. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/say-server/README.md "raw.githubusercontent.com"))

### 10.3 Video Resource Server (MediaSource archetype)

Demonstrates the "base64 blob resource" pattern: tool returns a `videoUri`, view fetches via `resources/read`, server returns base64 blob, view decodes and plays. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/video-resource-server/README.md "raw.githubusercontent.com"))

One of many uses of **resource-backed binary delivery**, may be to keep large media out of tool responses and make fetching explicit, cacheable, and composable. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/video-resource-server/README.md "raw.githubusercontent.com"))

### 10.4 Transcript Server (TranscriptStream archetype)

Demonstrates live transcription; streams interim transcripts to the model via `ui/update-model-context`, and sends completed transcription as `ui/message`. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/transcript-server/README.md "raw.githubusercontent.com"))

One of many uses of **interim context streaming**, may be to let an agent respond while the user is still speaking ("I'll start drafting the summary as you talk"). ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/transcript-server/README.md "raw.githubusercontent.com"))

### 10.5 Basic Host (Canvas scaffolding)

Shows a host that connects to multiple servers via a `SERVERS` env var and uses a double-iframe sandbox architecture; includes AppBridge setup and iframe management. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/basic-host/README.md "raw.githubusercontent.com"))

One of many uses of **basic-host as a proving ground**, may be to rapidly validate conductor "wiring" behaviors against a known-good sandbox pipeline before investing in a production-grade host. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

* * * * *

11) Known unknowns and low-confidence areas (explicit gaps)
-----------------------------------------------------------

### 11.1 State persistence and restoration are future work

The Apps spec lists "state persistence and restoration" and "view-to-view communication" as future/advanced features, not MVP guarantees. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

**Practical gap:** in the MVP, persistence is example-level (e.g., localStorage), so the conductor should treat persistence as a host/module policy rather than a standardized protocol feature. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/examples/pdf-server/README.md "raw.githubusercontent.com"))

### 11.2 Multiple UI resources per tool response is deferred

The spec explicitly lists "support multiple UI resources in a tool response" as a future extension. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

**Conductor impact:** for now, treat "one tool ↔ one view" as the reliable baseline; composite experiences should be built by mounting **multiple tools/apps** rather than assuming a single tool can return a multi-pane UI bundle. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 11.3 External URL embedding is deferred

The spec lists embedding external apps (`externalUrl`) as deferred, with rationale about review/screenshot/visibility concerns. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

**Demo impact:** keep the demo vehicle fully inside `ui://` resources so the conductor/canvas story stays aligned with what's stable. ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 11.4 Host variability is fundamental

The docs emphasize host support varies by client and hosts can restrict capabilities like openLink and tool access; treat capability discovery as runtime truth. ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

* * * * *

12) Quick cheat sheet (for coordinator/conductor teams)
-------------------------------------------------------

### 12.1 App discovery / eligibility

-   Extension negotiation: `capabilities.extensions["io.modelcontextprotocol/ui"]` with MIME types ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/overview "Extensions Overview - Model Context Protocol"))

-   Tool has `_meta.ui.resourceUri` and optional `visibility` ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

-   UI resource is `ui://...`, `text/html;profile=mcp-app`, may declare CSP/permissions ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 12.2 Host ↔ view messages you'll likely wire into the conductor event bus

-   View → Host: `ui/open-link`, `ui/request-display-mode`, `ui/update-model-context`, `ui/message`, `notifications/message`, plus `tools/call` and `resources/read` (proxied) ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

-   Host → View: `ui/notifications/tool-input-partial`, `ui/notifications/tool-input`, `ui/notifications/tool-result`, `ui/notifications/tool-cancelled`, `ui/notifications/host-context-changed`, `ui/notifications/size-changed`, `ui/resource-teardown` ([GitHub](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/refs/heads/main/specification/2026-01-26/apps.mdx "raw.githubusercontent.com"))

### 12.3 Contract-friendly payload shapes

-   `CallToolResult.structuredContent` + optional tool `outputSchema` for typed port contracts ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/schema "Schema Reference - Model Context Protocol"))

-   Use `content` as a human-readable shadow for compatibility and traceability ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

* * * * *

13) Pointers to "where to look next" (official sources)
-------------------------------------------------------

-   MCP Apps docs overview (host behavior, security model, supported clients, dev/testing) ([Model Context Protocol](https://modelcontextprotocol.io/docs/extensions/apps "MCP Apps - Model Context Protocol"))

-   MCP Apps spec (stable 2026-01-26) in ext-apps repo ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/?utm_source=chatgpt.com "@modelcontextprotocol/ext-apps - v1.0.1"))

-   ext-apps API docs (App, AppBridge, types, schemas, methods) ([modelcontextprotocol.github.io](https://modelcontextprotocol.github.io/ext-apps/api/modules/app.html "app | @modelcontextprotocol/ext-apps - v1.0.1"))

-   Core MCP spec pages: Tools, Resources, Logging, Lifecycle, Transports, Schema reference ([Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Tools - Model Context Protocol"))

* * * * *

If you want this in a "copy/paste into internal docs" form, I can reformat into:

1.  a **feature matrix** (Feature → "how it works" → "one of many uses..." → conductor notes → sources), and

2.  a **demo recipe** that maps each scenario beat to the exact message types and example modules that exercise it.