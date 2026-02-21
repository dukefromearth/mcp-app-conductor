# `mcp-app-conductor`

Conductor runtime for coordinating MCP modules on a shared canvas.

For the latest dependency architecture snapshot (repo-level Mermaid), run from repo root:

```bash
pnpm arch:deps:mermaid
```

## What this package is

`mcp-app-conductor` is the orchestration layer between:

- a host that renders MCP App views (`ui://` resources in iframes), and
- multiple MCP module servers that expose tools/resources/prompts.

It gives you:

- module registration + capability discovery,
- typed wiring of module output ports to module tool inputs,
- view mounting helpers (`tool` call + `ui://` resource fetch),
- swap planning (`auto`/`hot`/`warm`/`cold`) with fallback reasoning,
- an event-sourced in-memory state store,
- trace events and optional JSONL recording for causality.

It does not render UI. The host does.

## What this package is not

- Not a complete MCP host.
- Not an auth/multitenancy framework.
- Not a production policy engine.
- Not pixel-aware automation.

The conductor works on typed signals and declared contracts.

## Install

```bash
pnpm add mcp-app-conductor @mcp-app-conductor/contracts
```

Or in this monorepo:

```bash
pnpm install
pnpm --filter mcp-app-conductor build
```

## Mental model in 60 seconds

1. Register modules with a manifest/runtime profile.
2. Discover each module's live tools/resources/prompts.
3. Mount views by calling a tool that advertises `_meta.ui.resourceUri`.
4. Connect wiring edges: `from(module:port) -> to(module:tool:arg)`.
5. Emit port events; conductor routes matching edges to tool calls.
6. Inspect state/trace to explain what happened and why.

## Quick start

```ts
import { createConductor, JsonlRecorder } from 'mcp-app-conductor';
import { CONTRACT_VERSION, type ModuleManifest } from '@mcp-app-conductor/contracts';

const recorder = new JsonlRecorder({
  onLine: (line) => {
    console.log(line);
  },
});

const conductor = createConductor({ recorder });

const pdfManifest: ModuleManifest = {
  contractVersion: CONTRACT_VERSION,
  kind: 'module.manifest',
  extensions: {},
  id: 'pdf',
  version: '0.1.0',
  displayName: 'PDF',
  views: [{ resourceUri: 'ui://pdf/view.html', displayModes: ['main', 'sidebar'] }],
  outputs: [{ name: 'selectionText', schema: { type: 'string' } }],
  inputs: [],
  stateResources: [],
  runtime: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  },
};

const sayManifest: ModuleManifest = {
  contractVersion: CONTRACT_VERSION,
  kind: 'module.manifest',
  extensions: {},
  id: 'say',
  version: '0.1.0',
  displayName: 'Say',
  views: [{ resourceUri: 'ui://say/view.html', displayModes: ['pip', 'main'] }],
  outputs: [],
  inputs: [{ name: 'text', schema: { type: 'string' } }],
  stateResources: [],
  runtime: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  },
};

await conductor.registerModule({
  id: 'pdf',
  url: 'http://localhost:3001/mcp',
  manifest: pdfManifest,
});

await conductor.registerModule({
  id: 'say',
  url: 'http://localhost:3002/mcp',
  manifest: sayManifest,
});

await conductor.discoverCapabilities();

const mounted = await conductor.mountView({
  moduleId: 'pdf',
  toolName: 'openPdf',
  args: { uri: 'file:///demo.pdf' },
  mountPoint: 'main',
});

console.log(mounted.view.id, mounted.html.length);

conductor.connectPorts({
  from: { moduleId: 'pdf', port: 'selectionText', schema: { type: 'string' } },
  to: { moduleId: 'say', tool: 'say', arg: 'text', schema: { type: 'string' } },
  enabled: true,
});

await conductor.emitPortEvent({
  moduleId: 'pdf',
  port: 'selectionText',
  data: 'Read this text out loud.',
});

await conductor.close();
```

## Public API

```ts
createConductor(config?: {
  recorder?: JsonlRecorder;
  adapters?: TransportAdapter[];
  implementationName?: string;
  validationPolicy?: ValidationPolicy;
}): Conductor
```

`Conductor` methods:

- `registerModule(request)`: validates manifest/profile and records module registration.
- `discoverCapabilities(moduleId?)`: lists tools/resources/prompts from module(s).
- `mountView(request)`: calls a tool, reads its UI resource, returns `{ view, html, csp, permissions, toolResult }`.
- `validateWiringEdge(edge, state?)`: returns validation outcomes without mutating state.
- `connectPorts(edge)`: validates and commits wiring edge (or throws on enforced failures).
- `swapModule(request)`: resolves swap mode and remaps outgoing edges from source module to target module.
- `emitPortEvent(signal)`: emits `port.event`, routes matched edges, executes target tool calls.
- `reportValidationOutcome(outcome)`: injects explicit validation outcome into trace/state.
- `subscribe(listener)`: event subscription callback `(event, snapshot) => void`.
- `getState()`: current snapshot `{ modules, capabilityInventory, wiring, views, events }`.
- `getMetrics()`: dispatch and snapshot metrics.
- `getTrace(limit?)`: recent events (`limit` default `100`).
- `close()`: closes active module clients.

## Contracts you must satisfy

The conductor enforces Contract Spine v1 metadata on artifacts:

- `contractVersion`: semver, supported major `1`.
- `kind`: artifact type literal.
- `extensions`: namespaced object bag.

For module registration, you must provide a valid `module.manifest` and runtime profile (`module.runtimeProfile`).

### Minimal manifest shape

```ts
{
  contractVersion: '1.0.0',
  kind: 'module.manifest',
  extensions: {},
  id: 'your-module',
  version: '0.1.0',
  displayName: 'Your Module',
  views: [{ resourceUri: 'ui://your/view.html', displayModes: ['main'] }],
  outputs: [{ name: 'selectionText', schema: { type: 'string' } }],
  inputs: [{ name: 'text', schema: { type: 'string' } }],
  stateResources: [],
  runtime: {
    contractVersion: '1.0.0',
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  }
}
```

## Validation policy (default)

Defaults are hybrid strict:

- `enforce`: `cli.runtimeConfig`, `cli.profile`, `cli.flags`, `host.mountArgs`, `host.wireInput`, `conductor.wiringEdge`
- `warn`: `conductor.eventPayload`, `conductor.portSignal`

Behavior:

- `enforce`: operation rejects/throws.
- `warn`: emits `validation.outcome`, continues best-effort path.
- `observe`: record-only.

Override by passing `validationPolicy` to `createConductor(...)`.

## Wiring behavior

`connectPorts(...)` validates:

- source/target modules exist,
- source port exists in source manifest,
- target tool exists in discovered target capability inventory,
- source schema and target arg schema are compatible.

On connection attempts, conductor emits:

- `wiring.validate`,
- then `wiring.reject` or `wiring.warn` (if applicable),
- then `wiring.connected` and `wiring.accept` when committed.

## Swap behavior

`swapModule({ fromModuleId, toModuleId, mode })` resolves with fallback reasoning:

- `auto`: prefers `hot` if both sides support snapshot+restore; else `warm`; else `cold`.
- `hot`: falls back to `warm` or `cold` when unsupported.
- `warm`: falls back to `cold` when unsupported.

Trace events:

- `swap.plan`,
- optional `swap.fallback`,
- `swap.applied`.

## Transport behavior

Baseline supported by built-in module client: stateless Streamable HTTP.

If a module runtime profile uses `transportMode: 'session'`, registration is rejected unless:

- `transportAdapterId` is provided, and
- a matching `TransportAdapter` exists and returns `supports(profile) === true`.

Adapter contract:

```ts
interface TransportAdapter {
  id: string;
  description?: string;
  supports(profile: ModuleRuntimeProfile): boolean;
}
```

## View mounting requirements

For `mountView(...)` to work:

- `discoverCapabilities()` must find the target tool.
- Tool metadata must include a UI resource URI:
  - nested: `_meta.ui.resourceUri`
  - legacy: `_meta['ui/resourceUri']`
- `readResource(uri)` must return `contents[0].text` (HTML string).

Returned `csp` and `permissions` are read from resource metadata (`_meta.ui`).

## Event and trace model

All events are `conductor.event` envelopes with:

- `eventId`, `timestamp`, `traceId`, `type`, `source`, `payload`,
- contract metadata (`contractVersion`, `kind`, `extensions`).

Common event types:

- `module.registered`, `module.capabilities`, `module.error`, `module.rejected`
- `view.mounted`
- `port.event`
- `tool.call`, `tool.result`
- `wiring.validate`, `wiring.warn`, `wiring.reject`, `wiring.connected`, `wiring.accept`
- `swap.plan`, `swap.fallback`, `swap.applied`
- `validation.outcome`

State and recorder limits:

- in-memory state retains up to `5000` events,
- `JsonlRecorder` defaults to `5000` lines.

## Integration checklist

- Host:
  - render returned `html` in sandboxed iframe(s),
  - enforce capability gating and tool call permissions,
  - route UI-originated signals to `emitPortEvent(...)`,
  - surface trace timeline for debugging.
- Module:
  - expose valid manifest/profile,
  - declare output ports accurately,
  - expose tool schemas for target args,
  - include `_meta.ui.resourceUri` for mountable tools.

## Troubleshooting

- `Module X rejected: session transport requires a compatible adapter.`
  - Module profile is session-based without a supported adapter.
- `Tool Y not found for module X.`
  - Run `discoverCapabilities('X')` and verify tool name.
- `Tool Y does not expose _meta.ui.resourceUri.`
  - Mount tool is missing required UI metadata.
- `Wiring edge ... failed validation.`
  - Check module IDs, source port, discovered target tool, and schema compatibility.
- No downstream tool calls after `emitPortEvent`.
  - Ensure edge is `enabled: true`, module/port names match exactly, and signal passes validation policy.

## Development in this repo

```bash
pnpm --filter mcp-app-conductor typecheck
pnpm --filter mcp-app-conductor build
```

Conductor source:

- `packages/conductor/src/index.ts`
- `packages/conductor/src/types.ts`
- `packages/conductor/src/runtime/*`
- `packages/conductor/src/state/*`
- `packages/conductor/src/trace/jsonl-recorder.ts`
