import {
  CONTRACT_VERSION,
  defaultValidationPolicy,
  eventEnvelopeSchema,
  moduleConnectionSchema,
  moduleManifestSchema,
  moduleRuntimeProfileSchema,
  mountedViewSchema,
  portSignalSchema,
  swapModeSchema,
  validationOutcomeSchema,
  validationPolicySchema,
  wiringEdgeSchema,
  type EventEnvelope,
  type ModuleRuntimeProfile,
  type ValidationBoundary,
  type ValidationMode,
  type ValidationOutcome,
  type ValidationPolicy,
  type ValidationIssue,
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
  StoreMetrics,
  ValidationOutcomeInput,
} from './types';
import type { JsonlRecorder } from './trace/jsonl-recorder';
import { getAdapter, type TransportAdapter } from './runtime/transport-adapter';

export interface CreateConductorConfig {
  recorder?: JsonlRecorder;
  adapters?: TransportAdapter[];
  implementationName?: string;
  validationPolicy?: ValidationPolicy;
}

export interface Conductor {
  registerModule(request: ModuleRegistrationRequest): Promise<RegisteredModule>;
  discoverCapabilities(moduleId?: string): Promise<Record<string, CapabilityInventory>>;
  mountView(request: MountViewRequest): Promise<MountedViewResult>;
  validateWiringEdge(
    edge: Omit<WiringEdge, 'id' | 'contractVersion' | 'kind' | 'extensions'> & { id?: string },
    state?: ConductorSnapshot,
  ): ValidationOutcome[];
  connectPorts(
    edge: Omit<WiringEdge, 'id' | 'contractVersion' | 'kind' | 'extensions'> & { id?: string }
  ): WiringEdge;
  swapModule(request: SwapRequest): Promise<SwapPlan>;
  emitPortEvent(signal: PortSignal): Promise<void>;
  reportValidationOutcome(outcome: ValidationOutcomeInput): void;
  subscribe(listener: ConductorEventListener): () => void;
  getState(): ConductorSnapshot;
  getMetrics(): StoreMetrics;
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

function toValidationIssues(error: { issues: Array<{ path: Array<string | number>; message: string; code: string }> }): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
    code: issue.code,
  }));
}

function actorForBoundary(boundary: ValidationBoundary): EventEnvelope['source']['actor'] {
  if (boundary.startsWith('host.')) {
    return 'host';
  }

  if (boundary.startsWith('conductor.')) {
    return 'conductor';
  }

  return 'system';
}

function createValidationOutcome(
  boundary: ValidationBoundary,
  mode: ValidationMode,
  message: string,
  issues: ValidationIssue[],
): ValidationOutcome {
  return validationOutcomeSchema.parse({
    boundary,
    mode,
    ok: false,
    message,
    issues,
  });
}

function schemaType(schema: unknown): string | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const type = (schema as Record<string, unknown>).type;
  return typeof type === 'string' ? type : undefined;
}

function areSchemasCompatible(
  sourceSchema?: Record<string, unknown>,
  targetSchema?: Record<string, unknown>,
): boolean {
  const left = schemaType(sourceSchema);
  const right = schemaType(targetSchema);

  if (!left || !right) {
    return true;
  }

  if (left === right) {
    return true;
  }

  const numerics = new Set(['number', 'integer']);
  return numerics.has(left) && numerics.has(right);
}

function getToolArgSchema(tool: { inputSchema?: Record<string, unknown> }, arg: string): Record<string, unknown> | undefined {
  const schema = tool.inputSchema;
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') {
    return undefined;
  }

  const fieldSchema = (properties as Record<string, unknown>)[arg];
  if (!fieldSchema || typeof fieldSchema !== 'object') {
    return undefined;
  }

  return fieldSchema as Record<string, unknown>;
}

export function createConductor(config: CreateConductorConfig = {}): Conductor {
  const validationPolicy = validationPolicySchema.parse(config.validationPolicy ?? defaultValidationPolicy);
  const store = new ConductorStore({
    eventPayloadMode: validationPolicy['conductor.eventPayload'],
  });
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
      contractVersion: CONTRACT_VERSION,
      kind: 'conductor.event',
      extensions: {},
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

  function emitValidationOutcome(outcomeInput: ValidationOutcomeInput, traceId?: string): void {
    const outcome = validationOutcomeSchema.parse(outcomeInput);
    const source = {
      actor: actorForBoundary(outcome.boundary),
      operation: `validation:${outcome.boundary}`,
    } as const;

    pushEvent('validation.outcome', outcome, source, traceId ?? createId('trace'));
  }

  function reportValidationOutcome(outcomeInput: ValidationOutcomeInput): void {
    emitValidationOutcome(outcomeInput);
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

  function validateWiringEdge(
    edgeInput: Omit<WiringEdge, 'id' | 'contractVersion' | 'kind' | 'extensions'> & { id?: string },
    state = store.getState(),
  ): ValidationOutcome[] {
    const edge = wiringEdgeSchema.parse({
      contractVersion: CONTRACT_VERSION,
      kind: 'conductor.wiringEdge',
      extensions: {},
      ...edgeInput,
      id: edgeInput.id ?? createId('edge'),
    });
    const outcomes: ValidationOutcome[] = [];
    const policyMode = validationPolicy['conductor.wiringEdge'];

    const sourceModule = state.modules[edge.from.moduleId];
    if (!sourceModule) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        'enforce',
        `Source module "${edge.from.moduleId}" is not registered.`,
        [{
          path: `from.moduleId`,
          message: 'Unknown source module.',
          code: 'source_module_missing',
        }],
      ));
      return outcomes;
    }

    const targetModule = state.modules[edge.to.moduleId];
    if (!targetModule) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        'enforce',
        `Target module "${edge.to.moduleId}" is not registered.`,
        [{
          path: `to.moduleId`,
          message: 'Unknown target module.',
          code: 'target_module_missing',
        }],
      ));
      return outcomes;
    }

    const sourcePort = sourceModule.manifest.outputs.find((entry) => entry.name === edge.from.port);
    if (!sourcePort) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        'enforce',
        `Source port "${edge.from.port}" is not declared by module "${edge.from.moduleId}".`,
        [{
          path: 'from.port',
          message: 'Unknown output port in source module manifest.',
          code: 'source_port_missing',
        }],
      ));
    }

    const targetInventory = state.capabilityInventory[edge.to.moduleId];
    if (!targetInventory) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        'warn',
        `Target module "${edge.to.moduleId}" has no discovered capability inventory.`,
        [{
          path: 'to.moduleId',
          message: 'Run capability discovery before wiring this edge.',
          code: 'target_inventory_missing',
        }],
      ));
    }

    const targetTool = targetInventory?.tools.find((tool) => tool.name === edge.to.tool);
    if (targetInventory && !targetTool) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        'enforce',
        `Target tool "${edge.to.tool}" is not available on module "${edge.to.moduleId}".`,
        [{
          path: 'to.tool',
          message: 'Unknown target tool in discovered capability inventory.',
          code: 'target_tool_missing',
        }],
      ));
      return outcomes;
    }

    const sourceSchema = edge.from.schema ?? sourcePort?.schema;
    const targetSchema = edge.to.schema ?? (targetTool ? getToolArgSchema(targetTool, edge.to.arg) : undefined);

    if (!areSchemasCompatible(sourceSchema, targetSchema)) {
      outcomes.push(createValidationOutcome(
        'conductor.wiringEdge',
        policyMode,
        `Schema mismatch for edge "${edge.id}" from ${edge.from.moduleId}:${edge.from.port} to ${edge.to.moduleId}:${edge.to.tool}(${edge.to.arg}).`,
        [{
          path: 'from.schema',
          message: `Source type "${schemaType(sourceSchema) ?? 'unknown'}" does not match target type "${schemaType(targetSchema) ?? 'unknown'}".`,
          code: 'schema_mismatch',
        }],
      ));
    }

    return outcomes;
  }

  function connectPorts(
    edgeInput: Omit<WiringEdge, 'id' | 'contractVersion' | 'kind' | 'extensions'> & { id?: string }
  ): WiringEdge {
    const traceId = createId('trace');
    const edge = wiringEdgeSchema.parse({
      contractVersion: CONTRACT_VERSION,
      kind: 'conductor.wiringEdge',
      extensions: {},
      ...edgeInput,
      id: edgeInput.id ?? createId('edge'),
    });
    const outcomes = validateWiringEdge(edge, store.getState());
    const failing = outcomes.filter((outcome) => !outcome.ok);

    pushEvent(
      'wiring.validate',
      { edge, outcomes },
      { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
      traceId,
    );

    if (failing.length > 0) {
      const hasEnforcedFailure = failing.some((outcome) => outcome.mode === 'enforce');

      for (const outcome of failing) {
        emitValidationOutcome(outcome, traceId);
      }

      if (hasEnforcedFailure) {
        pushEvent(
          'wiring.reject',
          { edge, outcomes: failing },
          { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
          traceId,
        );
        throw new Error(`Wiring edge ${edge.id} failed validation.`);
      }

      pushEvent(
        'wiring.warn',
        { edge, outcomes: failing },
        { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
        traceId,
      );
    }

    pushEvent(
      'wiring.connected',
      { edge },
      { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
      traceId,
    );

    pushEvent(
      'wiring.accept',
      { edge, outcomes },
      { actor: 'conductor', moduleId: edge.from.moduleId, operation: 'connectPorts' },
      traceId,
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
    const validationMode = validationPolicy['conductor.portSignal'];
    const operationTraceId = signal.traceId ?? createId('trace');
    const parsedSignal = portSignalSchema.safeParse(signal);

    if (!parsedSignal.success) {
      const issues = toValidationIssues(parsedSignal.error);
      const outcome = validationOutcomeSchema.parse({
        boundary: 'conductor.portSignal',
        mode: validationMode,
        ok: false,
        message: 'Port signal validation failed.',
        issues,
      });
      emitValidationOutcome(outcome, operationTraceId);

      if (validationMode === 'enforce') {
        throw new Error('Port signal validation failed.');
      }

      return;
    }

    const validatedSignal = parsedSignal.data;
    const traceId = validatedSignal.traceId ?? operationTraceId;

    const event = pushEvent(
      'port.event',
      {
        moduleId: validatedSignal.moduleId,
        port: validatedSignal.port,
        data: validatedSignal.data,
      },
      {
        actor: 'module',
        moduleId: validatedSignal.moduleId,
        operation: `port:${validatedSignal.port}`,
      },
      traceId,
    );

    const actions = routePortEventToActions(event, store.getState().wiring, {
      mode: validationMode,
      onValidationOutcome: (outcome) => {
        emitValidationOutcome(outcome, traceId);
      },
    });

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

  function getMetrics(): StoreMetrics {
    return store.getMetrics();
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
    reportValidationOutcome,
    validateWiringEdge,
    subscribe,
    getState,
    getMetrics,
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
  StoreMetrics,
  SwapPlan,
  SwapRequest,
  ValidationOutcomeInput,
} from './types';

export { JsonlRecorder } from './trace/jsonl-recorder';
export type { TransportAdapter } from './runtime/transport-adapter';
export { extractPdfSelection, extractSelectionFromModelContext } from './adapters/pdf-context';
