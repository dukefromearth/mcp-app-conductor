import {
  eventEnvelopeSchema,
  moduleConnectionSchema,
  moduleManifestSchema,
  moduleRuntimeProfileSchema,
  mountedViewSchema,
  swapModeSchema,
  swapSupportSchema,
  wiringEdgeSchema,
  type EventEnvelope,
  type ModuleRuntimeProfile,
  type SwapMode,
  type WiringEdge,
} from '@mcp-app-conductor/contracts';
import { ModuleClient } from './runtime/module-client';
import { routePortEventToActions } from './runtime/wiring';
import { resolveSwapPlan } from './runtime/swap';
import { ConductorStore } from './state/store';
import type {
  CapabilityInventory,
  ConductorEventListener,
  ConductorSnapshot,
  ModuleRegistrationRequest,
  MountViewRequest,
  MountedViewResult,
  PortSignal,
  RegisteredModule,
  SwapPlan,
  SwapRequest,
} from './types';
import type { JsonlRecorder } from './trace/jsonl-recorder';
import { getAdapter, type TransportAdapter } from './runtime/transport-adapter';

export interface CreateConductorConfig {
  recorder?: JsonlRecorder;
  adapters?: TransportAdapter[];
  implementationName?: string;
}

export interface Conductor {
  registerModule(request: ModuleRegistrationRequest): Promise<RegisteredModule>;
  discoverCapabilities(moduleId?: string): Promise<Record<string, CapabilityInventory>>;
  mountView(request: MountViewRequest): Promise<MountedViewResult>;
  connectPorts(edge: Omit<WiringEdge, 'id'> & { id?: string }): WiringEdge;
  swapModule(request: SwapRequest): Promise<SwapPlan>;
  emitPortEvent(signal: PortSignal): Promise<void>;
  subscribe(listener: ConductorEventListener): () => void;
  getState(): ConductorSnapshot;
  getTrace(limit?: number): EventEnvelope[];
  close(): Promise<void>;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getResourceUriFromTool(tool: { _meta?: Record<string, unknown> }): string | undefined {
  const nested = tool._meta?.ui as Record<string, unknown> | undefined;
  const fromNested = typeof nested?.resourceUri === 'string' ? nested.resourceUri : undefined;
  const fromLegacy = typeof tool._meta?.['ui/resourceUri'] === 'string'
    ? (tool._meta['ui/resourceUri'] as string)
    : undefined;

  return fromNested ?? fromLegacy;
}

function getHtmlFromReadResourceResult(result: { contents?: Array<Record<string, unknown>> }): {
  html: string;
  csp?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
} {
  const first = result.contents?.[0];
  if (!first || typeof first.text !== 'string') {
    throw new Error('UI resource is missing text/html content');
  }

  const meta = first._meta as Record<string, unknown> | undefined;
  const uiMeta = (meta?.ui as Record<string, unknown> | undefined) ?? {};

  return {
    html: first.text,
    csp: uiMeta.csp as Record<string, unknown> | undefined,
    permissions: uiMeta.permissions as Record<string, unknown> | undefined,
  };
}

export function createConductor(config: CreateConductorConfig = {}): Conductor {
  const store = new ConductorStore();
  const recorder = config.recorder;
  const moduleClients = new Map<string, ModuleClient>();
  const adapters = new Map<string, TransportAdapter>((config.adapters ?? []).map((adapter) => [adapter.id, adapter]));

  function pushEvent(
    type: string,
    payload: unknown,
    source: EventEnvelope['source'],
    traceId = createId('trace'),
  ): EventEnvelope {
    const event = eventEnvelopeSchema.parse({
      eventId: createId('evt'),
      timestamp: new Date().toISOString(),
      traceId,
      type,
      source,
      payload,
    });

    recorder?.record(event);
    store.dispatch(event);
    return event;
  }

  function getModule(moduleId: string): RegisteredModule {
    const moduleEntry = store.getState().modules[moduleId];
    if (!moduleEntry) {
      throw new Error(`Module ${moduleId} is not registered.`);
    }

    return moduleEntry;
  }

  async function getOrCreateModuleClient(moduleId: string): Promise<ModuleClient> {
    const moduleEntry = getModule(moduleId);
    const existing = moduleClients.get(moduleId);

    if (existing) {
      return existing;
    }

    const client = new ModuleClient(moduleEntry.url);
    await client.connect();
    moduleClients.set(moduleId, client);
    return client;
  }

  async function registerModule(request: ModuleRegistrationRequest): Promise<RegisteredModule> {
    const manifest = moduleManifestSchema.parse(request.manifest);
    const runtime = moduleRuntimeProfileSchema.parse(request.profile ?? manifest.runtime);

    const connection = moduleConnectionSchema.parse({
      id: request.id,
      url: request.url,
      manifest,
      profile: runtime,
      transportAdapterId: request.transportAdapterId,
    });

    if (runtime.transportMode === 'session') {
      const adapter = getAdapter(adapters, request.transportAdapterId);

      if (!adapter || !adapter.supports(runtime)) {
        pushEvent(
          'module.rejected',
          {
            moduleId: request.id,
            reason: `Module requires session transport. Adapter ${request.transportAdapterId ?? '<none>'} is missing or incompatible.`,
          },
          { actor: 'conductor', moduleId: request.id, operation: 'registerModule' },
        );
        throw new Error(`Module ${request.id} rejected: session transport requires a compatible adapter.`);
      }
    }

    const moduleEntry: RegisteredModule = {
      ...connection,
      status: 'registered',
    };

    pushEvent(
      'module.registered',
      { module: moduleEntry },
      { actor: 'conductor', moduleId: request.id, operation: 'registerModule' },
    );

    return moduleEntry;
  }

  async function discoverCapabilities(moduleId?: string): Promise<Record<string, CapabilityInventory>> {
    const snapshot = store.getState();
    const targetIds = moduleId ? [moduleId] : Object.keys(snapshot.modules);
    const discovered: Record<string, CapabilityInventory> = {};

    for (const id of targetIds) {
      try {
        const client = await getOrCreateModuleClient(id);
        const capabilities = await client.discoverCapabilities();

        discovered[id] = capabilities;

        pushEvent(
          'module.capabilities',
          { moduleId: id, capabilities },
          { actor: 'conductor', moduleId: id, operation: 'discoverCapabilities' },
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        pushEvent(
          'module.error',
          { moduleId: id, reason },
          { actor: 'conductor', moduleId: id, operation: 'discoverCapabilities' },
        );
      }
    }

    return discovered;
  }

  async function mountView(request: MountViewRequest): Promise<MountedViewResult> {
    const traceId = createId('trace');
    const args = request.args ?? {};

    const client = await getOrCreateModuleClient(request.moduleId);

    const state = store.getState();
    const inventory = state.capabilityInventory[request.moduleId] ?? (await discoverCapabilities(request.moduleId))[request.moduleId];
    const tool = inventory.tools.find((entry) => entry.name === request.toolName);

    if (!tool) {
      throw new Error(`Tool ${request.toolName} not found for module ${request.moduleId}.`);
    }

    const resourceUri = getResourceUriFromTool(tool);
    if (!resourceUri) {
      throw new Error(`Tool ${request.toolName} does not expose _meta.ui.resourceUri.`);
    }

    pushEvent(
      'tool.call',
      {
        moduleId: request.moduleId,
        toolName: request.toolName,
        args,
      },
      { actor: 'conductor', moduleId: request.moduleId, operation: 'mountView' },
      traceId,
    );

    const toolResult = await client.callTool(request.toolName, args);

    pushEvent(
      'tool.result',
      {
        moduleId: request.moduleId,
        toolName: request.toolName,
        result: toolResult,
      },
      { actor: 'module', moduleId: request.moduleId, operation: 'mountView' },
      traceId,
    );

    const resourceResult = await client.readResource(resourceUri);
    const parsedResource = getHtmlFromReadResourceResult(resourceResult as { contents?: Array<Record<string, unknown>> });

    const view = mountedViewSchema.parse({
      id: createId('view'),
      moduleId: request.moduleId,
      toolName: request.toolName,
      resourceUri,
      mountPoint: request.mountPoint,
      createdAt: new Date().toISOString(),
    });

    pushEvent(
      'view.mounted',
      { view },
      { actor: 'host', moduleId: request.moduleId, viewId: view.id, operation: 'mountView' },
      traceId,
    );

    return {
      view,
      html: parsedResource.html,
      csp: parsedResource.csp,
      permissions: parsedResource.permissions,
      toolResult,
    };
  }

  function connectPorts(edgeInput: Omit<WiringEdge, 'id'> & { id?: string }): WiringEdge {
    const edge = wiringEdgeSchema.parse({
      ...edgeInput,
      id: edgeInput.id ?? createId('edge'),
    });

    pushEvent(
      'wiring.connected',
      { edge },
      { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
    );

    return edge;
  }

  async function swapModule(request: SwapRequest): Promise<SwapPlan> {
    const traceId = createId('trace');
    const requestedMode = swapModeSchema.parse(request.mode ?? 'auto');
    const fromModule = getModule(request.fromModuleId);
    const toModule = getModule(request.toModuleId);

    const fromProfile = moduleRuntimeProfileSchema.parse(fromModule.profile ?? fromModule.manifest.runtime);
    const toProfile = moduleRuntimeProfileSchema.parse(toModule.profile ?? toModule.manifest.runtime);

    const plan = resolveSwapPlan(fromProfile, toProfile, requestedMode);

    pushEvent(
      'swap.plan',
      {
        fromModuleId: request.fromModuleId,
        toModuleId: request.toModuleId,
        requested: requestedMode,
        resolved: plan.resolved,
        reasons: plan.reasons,
      },
      { actor: 'conductor', moduleId: request.fromModuleId, operation: 'swapModule' },
      traceId,
    );

    if (plan.fallbackUsed) {
      pushEvent(
        'swap.fallback',
        {
          fromModuleId: request.fromModuleId,
          toModuleId: request.toModuleId,
          requested: requestedMode,
          resolved: plan.resolved,
          reasons: plan.reasons,
        },
        { actor: 'conductor', moduleId: request.fromModuleId, operation: 'swapModule' },
        traceId,
      );
    }

    const state = store.getState();
    const remappedEdges = state.wiring
      .filter((edge) => edge.from.moduleId === request.fromModuleId)
      .map((edge) => wiringEdgeSchema.parse({
        ...edge,
        from: {
          ...edge.from,
          moduleId: request.toModuleId,
        },
      }));

    const retainedEdges = state.wiring.filter((edge) => edge.from.moduleId !== request.fromModuleId);
    const edgeIds = remappedEdges.map((edge) => edge.id);

    retainedEdges.forEach((edge) => {
      // Replay retained edges into a fresh store state via events to keep event-sourced semantics.
      // No-op here by design; existing edges already remain in state.
      void edge;
    });

    remappedEdges.forEach((edge) => {
      pushEvent(
        'wiring.connected',
        { edge },
        { actor: 'conductor', moduleId: request.toModuleId, operation: 'swapModule' },
        traceId,
      );
    });

    pushEvent(
      'swap.applied',
      {
        fromModuleId: request.fromModuleId,
        toModuleId: request.toModuleId,
        edgeIds,
      },
      { actor: 'conductor', moduleId: request.toModuleId, operation: 'swapModule' },
      traceId,
    );

    return plan;
  }

  async function emitPortEvent(signal: PortSignal): Promise<void> {
    const traceId = signal.traceId ?? createId('trace');

    const event = pushEvent(
      'port.event',
      {
        moduleId: signal.moduleId,
        port: signal.port,
        data: signal.data,
      },
      {
        actor: 'module',
        moduleId: signal.moduleId,
        operation: `port:${signal.port}`,
      },
      traceId,
    );

    const actions = routePortEventToActions(event, store.getState().wiring);

    for (const action of actions) {
      const client = await getOrCreateModuleClient(action.moduleId);

      pushEvent(
        'tool.call',
        {
          moduleId: action.moduleId,
          toolName: action.toolName,
          args: action.args,
          edgeId: action.edgeId,
        },
        { actor: 'conductor', moduleId: action.moduleId, operation: 'routeEvent' },
        traceId,
      );

      const result = await client.callTool(action.toolName, action.args);

      pushEvent(
        'tool.result',
        {
          moduleId: action.moduleId,
          toolName: action.toolName,
          result,
          edgeId: action.edgeId,
        },
        { actor: 'module', moduleId: action.moduleId, operation: 'routeEvent' },
        traceId,
      );
    }
  }

  function subscribe(listener: ConductorEventListener): () => void {
    return store.subscribe(listener);
  }

  function getState(): ConductorSnapshot {
    return store.getState();
  }

  function getTrace(limit = 100): EventEnvelope[] {
    const events = store.getState().events;
    return events.slice(Math.max(0, events.length - limit));
  }

  async function close(): Promise<void> {
    const clients = [...moduleClients.values()];
    await Promise.all(clients.map(async (client) => client.close()));
    moduleClients.clear();
  }

  return {
    registerModule,
    discoverCapabilities,
    mountView,
    connectPorts,
    swapModule,
    emitPortEvent,
    subscribe,
    getState,
    getTrace,
    close,
  };
}

export type {
  CapabilityInventory,
  ConductorEventListener,
  ConductorSnapshot,
  ModuleRegistrationRequest,
  MountViewRequest,
  MountedViewResult,
  PortSignal,
  RegisteredModule,
  SwapPlan,
  SwapRequest,
} from './types';

export { JsonlRecorder } from './trace/jsonl-recorder';
export type { TransportAdapter } from './runtime/transport-adapter';
export { extractPdfSelection, extractSelectionFromModelContext } from './adapters/pdf-context';
