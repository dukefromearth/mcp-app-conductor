import {
  AppBridge,
  PostMessageTransport,
  type McpUiMessageRequest,
  type McpUiUpdateModelContextRequest,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CONTRACT_VERSION,
  displayModeSchema,
  modulePortSpecifierSchema,
  moduleProfileSchema,
  moduleToolArgSpecifierSchema,
  mountArgsSchema,
  swapModeSchema,
  type DisplayMode,
  type EventEnvelope,
  type ValidationIssue,
} from '@mcp-app-conductor/contracts';
import {
  createConductor,
  extractSelectionFromModelContext,
  type ConductorSnapshot,
  type MountedViewResult,
} from 'mcp-app-conductor';
import './style.css';

const hostImplementation = {
  name: 'mcp-app-conductor-host',
  version: '0.1.0',
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app mount point');
}

const query = new URLSearchParams(window.location.search);
const servers = {
  pdf: query.get('pdf') ?? 'http://localhost:3001/mcp',
  say: query.get('say') ?? 'http://localhost:3002/mcp',
};

const pdfProfile = moduleProfileSchema.parse({
  contractVersion: CONTRACT_VERSION,
  kind: 'module.profile',
  extensions: {},
  manifest: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.manifest',
    extensions: {},
    id: 'pdf',
    version: '2.0.0',
    displayName: 'PDF Server',
    views: [{ resourceUri: 'ui://pdf-viewer/mcp-app.html', displayModes: ['main', 'sidebar', 'fullscreen'] }],
    outputs: [{ name: 'selectionText', description: 'Text selected in PDF context markers' }],
    inputs: [],
    stateResources: [],
    runtime: {
      contractVersion: CONTRACT_VERSION,
      kind: 'module.runtimeProfile',
      extensions: {},
      transportMode: 'stateless',
      stateModel: 'ephemeral',
      affinity: 'none',
      swapSupport: { hot: false, warm: true, cold: true },
    },
  },
  runtime: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: 'stateless',
    stateModel: 'ephemeral',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  },
  ports: {
    outputs: [{ name: 'selectionText', description: 'DocumentSource selected text' }],
    inputs: [],
  },
});

const sayProfile = moduleProfileSchema.parse({
  contractVersion: CONTRACT_VERSION,
  kind: 'module.profile',
  extensions: {},
  manifest: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.manifest',
    extensions: {},
    id: 'say',
    version: '1.0.0',
    displayName: 'Say Demo',
    views: [{ resourceUri: 'ui://say-demo/view.html', displayModes: ['pip', 'overlay', 'fullscreen'] }],
    outputs: [{ name: 'playbackState', description: 'Playback state updates' }],
    inputs: [{ name: 'text', description: 'Text input routed to say(text)' }],
    stateResources: [],
    runtime: {
      contractVersion: CONTRACT_VERSION,
      kind: 'module.runtimeProfile',
      extensions: {},
      transportMode: 'stateless',
      stateModel: 'ephemeral',
      affinity: 'none',
      swapSupport: { hot: false, warm: true, cold: true },
    },
  },
  runtime: {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: 'stateless',
    stateModel: 'ephemeral',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  },
  ports: {
    outputs: [{ name: 'playbackState', description: 'Audio sink status output' }],
    inputs: [{ name: 'text', description: 'Audio sink input' }],
  },
});

type ModelContext = McpUiUpdateModelContextRequest['params'];
type AppMessage = McpUiMessageRequest['params'];

interface MountedViewInstance {
  bridge: AppBridge;
  iframe: HTMLIFrameElement;
  viewId: string;
}

const conductor = createConductor();
const hostClients = new Map<string, Client>();
const mountedViewMap = new Map<string, MountedViewInstance>();
let latestState: ConductorSnapshot = conductor.getState();

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">MCP App Conductor</p>
        <h1>Shared Canvas Control Deck</h1>
      </div>
      <div class="meta">
        <div><span>PDF</span><code>${servers.pdf}</code></div>
        <div><span>SAY</span><code>${servers.say}</code></div>
      </div>
    </header>

    <section class="controls">
      <form id="mount-form" class="card">
        <h2>Mount View</h2>
        <label>Module <select name="module" id="mount-module"></select></label>
        <label>Tool <select name="tool" id="mount-tool"></select></label>
        <label>Mount point
          <select name="mountPoint" id="mount-point">
            <option value="main">main</option>
            <option value="sidebar">sidebar</option>
            <option value="overlay">overlay</option>
            <option value="pip">pip</option>
            <option value="fullscreen">fullscreen</option>
          </select>
        </label>
        <label>Tool args (JSON)
          <textarea id="mount-args">{}</textarea>
        </label>
        <button type="submit">Mount</button>
      </form>

      <form id="wire-form" class="card">
        <h2>Connect Ports</h2>
        <label>From <input id="wire-from" value="pdf:selectionText" /></label>
        <label>To <input id="wire-to" value="say:say:text" /></label>
        <button type="submit">Connect</button>
      </form>

      <form id="swap-form" class="card">
        <h2>Swap Module</h2>
        <label>From <input id="swap-from" value="pdf" /></label>
        <label>To <input id="swap-to" value="say" /></label>
        <label>Mode
          <select id="swap-mode">
            <option value="auto">auto</option>
            <option value="hot">hot</option>
            <option value="warm">warm</option>
            <option value="cold">cold</option>
          </select>
        </label>
        <button type="submit">Swap</button>
      </form>

      <div class="card inventory" id="inventory"></div>
      <div class="card trace" id="trace"></div>
    </section>

    <section class="canvas">
      <article class="lane" data-lane="main"><h3>Main</h3><div class="lane-body" id="lane-main"></div></article>
      <article class="lane" data-lane="sidebar"><h3>Sidebar</h3><div class="lane-body" id="lane-sidebar"></div></article>
      <article class="lane" data-lane="overlay"><h3>Overlay</h3><div class="lane-body" id="lane-overlay"></div></article>
      <article class="lane" data-lane="pip"><h3>PiP</h3><div class="lane-body" id="lane-pip"></div></article>
      <article class="lane" data-lane="fullscreen"><h3>Fullscreen</h3><div class="lane-body" id="lane-fullscreen"></div></article>
    </section>
  </div>
`;

function requiredElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return el;
}

const mountForm = requiredElement<HTMLFormElement>('#mount-form');
const wireForm = requiredElement<HTMLFormElement>('#wire-form');
const swapForm = requiredElement<HTMLFormElement>('#swap-form');
const mountModule = requiredElement<HTMLSelectElement>('#mount-module');
const mountTool = requiredElement<HTMLSelectElement>('#mount-tool');
const mountArgs = requiredElement<HTMLTextAreaElement>('#mount-args');
const mountPoint = requiredElement<HTMLSelectElement>('#mount-point');
const inventoryEl = requiredElement<HTMLDivElement>('#inventory');
const traceEl = requiredElement<HTMLDivElement>('#trace');
const wireFrom = requiredElement<HTMLInputElement>('#wire-from');
const wireTo = requiredElement<HTMLInputElement>('#wire-to');
const swapFrom = requiredElement<HTMLInputElement>('#swap-from');
const swapTo = requiredElement<HTMLInputElement>('#swap-to');
const swapMode = requiredElement<HTMLSelectElement>('#swap-mode');

function laneEl(mode: DisplayMode): HTMLDivElement {
  const target = document.querySelector<HTMLDivElement>(`#lane-${mode}`);
  if (!target) {
    throw new Error(`Missing lane ${mode}`);
  }

  return target;
}

function toValidationIssues(error: { issues: Array<{ path: Array<string | number>; message: string; code: string }> }): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
    code: issue.code,
  }));
}

function reportHostValidationOutcome(
  boundary: 'host.mountArgs' | 'host.wireInput',
  message: string,
  issues: ValidationIssue[],
): void {
  conductor.reportValidationOutcome({
    boundary,
    mode: 'enforce',
    ok: false,
    message,
    issues,
  });
}

async function getOrCreateHostClient(moduleId: string): Promise<Client> {
  const existing = hostClients.get(moduleId);
  if (existing) {
    return existing;
  }

  const module = latestState.modules[moduleId];
  if (!module) {
    throw new Error(`Unknown module ${moduleId}`);
  }

  const client = new Client(hostImplementation);
  await client.connect(new StreamableHTTPClientTransport(new URL(module.url)));
  hostClients.set(moduleId, client);
  return client;
}

function formatTrace(events: EventEnvelope[]): string {
  return events
    .slice(Math.max(0, events.length - 40))
    .map((event) => `${event.timestamp} | ${event.type} | ${event.traceId} | ${event.source.moduleId ?? '-'} | ${event.source.operation ?? '-'}`)
    .join('\n');
}

function updateMountToolOptions(moduleId: string): void {
  const inventory = latestState.capabilityInventory[moduleId];
  const tools = inventory?.tools ?? [];

  mountTool.innerHTML = tools
    .map((tool) => `<option value="${tool.name}">${tool.name}</option>`)
    .join('');
}

function renderState(): void {
  latestState = conductor.getState();
  const moduleIds = Object.keys(latestState.modules);

  mountModule.innerHTML = moduleIds.map((id) => `<option value="${id}">${id}</option>`).join('');

  if (moduleIds.length > 0) {
    const selected = mountModule.value || moduleIds[0];
    mountModule.value = selected;
    updateMountToolOptions(selected);
  }

  inventoryEl.innerHTML = `
    <h2>Inventory</h2>
    <p><strong>Modules:</strong> ${moduleIds.length}</p>
    <p><strong>Wiring Edges:</strong> ${latestState.wiring.length}</p>
    <p><strong>Mounted Views:</strong> ${latestState.views.length}</p>
    <p><strong>Events:</strong> ${latestState.events.length}</p>
    <pre>${JSON.stringify({
      modules: Object.values(latestState.modules).map((module) => ({ id: module.id, status: module.status })),
      wiring: latestState.wiring,
    }, null, 2)}</pre>
  `;

  traceEl.innerHTML = `
    <h2>Trace</h2>
    <pre>${formatTrace(latestState.events)}</pre>
  `;
}

async function mountMcpApp(
  moduleId: string,
  mountResult: MountedViewResult,
  args: Record<string, unknown>,
): Promise<void> {
  const lane = laneEl(mountResult.view.mountPoint);
  const card = document.createElement('section');
  card.className = 'view-card';
  card.innerHTML = `
    <header>
      <h4>${mountResult.view.moduleId}:${mountResult.view.toolName}</h4>
      <small>${mountResult.view.id}</small>
    </header>
  `;

  const iframe = document.createElement('iframe');
  iframe.className = 'view-frame';
  iframe.sandbox.add('allow-scripts', 'allow-forms', 'allow-popups', 'allow-modals', 'allow-downloads');
  iframe.referrerPolicy = 'no-referrer';
  card.appendChild(iframe);
  lane.prepend(card);

  const serverClient = await getOrCreateHostClient(moduleId);
  const serverCapabilities = serverClient.getServerCapabilities();

  const appBridge = new AppBridge(
    serverClient,
    hostImplementation,
    {
      openLinks: {},
      serverTools: serverCapabilities?.tools,
      serverResources: serverCapabilities?.resources,
      updateModelContext: { text: {} },
    },
    {
      hostContext: {
        theme: 'light',
        platform: 'web',
        displayMode: mountResult.view.mountPoint === 'fullscreen' ? 'fullscreen' : 'inline',
        availableDisplayModes: ['inline', 'fullscreen', 'pip'],
        containerDimensions: { maxHeight: 900, width: 1200 },
      },
    },
  );

  appBridge.onloggingmessage = (params) => {
    console.info('[MCP APP LOG]', params);
  };

  appBridge.onmessage = async (params: AppMessage) => {
    console.info('[MCP APP MESSAGE]', params);
    return {};
  };

  appBridge.onopenlink = async (params) => {
    window.open(params.url, '_blank', 'noopener,noreferrer');
    return {};
  };

  appBridge.onupdatemodelcontext = async (params: ModelContext) => {
    const selection = moduleId === 'pdf' ? extractSelectionFromModelContext(params) : null;
    if (selection) {
      await conductor.emitPortEvent({
        moduleId: 'pdf',
        port: 'selectionText',
        data: selection,
      });
    }

    return {};
  };

  const initializedPromise = new Promise<void>((resolve) => {
    const existing = appBridge.oninitialized;
    appBridge.oninitialized = (...cbArgs) => {
      resolve();
      appBridge.oninitialized = existing;
      appBridge.oninitialized?.(...cbArgs);
    };
  });

  await appBridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  iframe.srcdoc = mountResult.html;
  await initializedPromise;
  appBridge.sendToolInput({ arguments: args });
  appBridge.sendToolResult(mountResult.toolResult as never);

  mountedViewMap.set(mountResult.view.id, {
    bridge: appBridge,
    iframe,
    viewId: mountResult.view.id,
  });
}

mountModule.addEventListener('change', () => {
  updateMountToolOptions(mountModule.value);
});

mountForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const moduleId = mountModule.value;
  const toolName = mountTool.value;
  const parsedMountPoint = displayModeSchema.parse(mountPoint.value);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(mountArgs.value || '{}');
  } catch {
    const issues: ValidationIssue[] = [{
      path: '<root>',
      message: 'Tool args must be valid JSON.',
      code: 'invalid_json',
    }];
    reportHostValidationOutcome('host.mountArgs', 'Mount args parsing failed.', issues);
    console.error('Mount args parsing failed.');
    return;
  }

  const parsedArgs = mountArgsSchema.safeParse(parsedJson);
  if (!parsedArgs.success) {
    reportHostValidationOutcome(
      'host.mountArgs',
      'Mount args validation failed.',
      toValidationIssues(parsedArgs.error),
    );
    console.error('Mount args validation failed.');
    return;
  }

  const args = parsedArgs.data;

  try {
    const result = await conductor.mountView({
      moduleId,
      toolName,
      mountPoint: parsedMountPoint,
      args,
    });

    await mountMcpApp(moduleId, result, args);
    renderState();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
});

wireForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const fromParsed = modulePortSpecifierSchema.safeParse(wireFrom.value);
  const toParsed = moduleToolArgSpecifierSchema.safeParse(wireTo.value);

  if (!fromParsed.success || !toParsed.success) {
    const issues: ValidationIssue[] = [];
    if (!fromParsed.success) {
      issues.push(...toValidationIssues(fromParsed.error));
    }
    if (!toParsed.success) {
      issues.push(...toValidationIssues(toParsed.error));
    }

    reportHostValidationOutcome(
      'host.wireInput',
      'Wire input validation failed. Expected module:port and module:tool:arg.',
      issues,
    );
    console.error('Wire input validation failed.');
    return;
  }

  const [fromModuleId, fromPort] = fromParsed.data.split(':');
  const [toModuleId, toTool, toArg] = toParsed.data.split(':');

  try {
    conductor.connectPorts({
      from: { moduleId: fromModuleId, port: fromPort },
      to: { moduleId: toModuleId, tool: toTool, arg: toArg },
      enabled: true,
    });

    renderState();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
});

swapForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const plan = await conductor.swapModule({
    fromModuleId: swapFrom.value,
    toModuleId: swapTo.value,
    mode: swapModeSchema.parse(swapMode.value),
  });

  console.info('Swap plan', plan);
  renderState();
});

conductor.subscribe(() => {
  renderState();
});

async function bootstrap(): Promise<void> {
  await conductor.registerModule({
    id: 'pdf',
    url: servers.pdf,
    manifest: pdfProfile.manifest,
    profile: pdfProfile.runtime,
  });

  await conductor.registerModule({
    id: 'say',
    url: servers.say,
    manifest: sayProfile.manifest,
    profile: sayProfile.runtime,
  });

  await conductor.discoverCapabilities();

  conductor.connectPorts({
    id: 'edge-pdf-selection-to-say',
    from: { moduleId: 'pdf', port: 'selectionText' },
    to: { moduleId: 'say', tool: 'say', arg: 'text' },
    enabled: true,
  });

  renderState();
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
});
