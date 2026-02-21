import { z } from 'zod';
import { CONTRACT_VERSION, contractMetadataSchemaForKind } from './core.js';
import { validationOutcomeSchema } from './validation.js';

export const displayModeSchema = z.enum(['main', 'sidebar', 'overlay', 'pip', 'fullscreen']);

export const moduleViewSchema = z.object({
  resourceUri: z.string().min(1),
  displayModes: z.array(displayModeSchema).nonempty(),
});

export const modulePortSchema = z.object({
  name: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
  description: z.string().optional(),
});

export const transportModeSchema = z.enum(['stateless', 'session']);
export const stateModelSchema = z.enum(['none', 'ephemeral', 'durable']);
export const affinitySchema = z.enum(['none', 'session', 'instance']);
export const swapModeSchema = z.enum(['hot', 'warm', 'cold', 'auto']);

export const swapSupportSchema = z.object({
  hot: z.boolean().default(false),
  warm: z.boolean().default(true),
  cold: z.literal(true).default(true),
});

function defaultRuntimeProfile() {
  return {
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile' as const,
    extensions: {} as Record<string, unknown>,
    transportMode: 'stateless' as const,
    stateModel: 'none' as const,
    affinity: 'none' as const,
    swapSupport: { hot: false, warm: true, cold: true as const },
  };
}

export const moduleRuntimeProfileSchema = contractMetadataSchemaForKind('module.runtimeProfile').extend({
  transportMode: transportModeSchema.default('stateless'),
  stateModel: stateModelSchema.default('none'),
  affinity: affinitySchema.default('none'),
  swapSupport: swapSupportSchema.default({ hot: false, warm: true, cold: true }),
  snapshotTool: z.string().min(1).optional(),
  restoreTool: z.string().min(1).optional(),
});

export const eventSourceSchema = z.object({
  actor: z.enum(['conductor', 'host', 'module', 'agent', 'system']).default('system'),
  moduleId: z.string().optional(),
  viewId: z.string().optional(),
  operation: z.string().optional(),
});

export const eventEnvelopeSchema = contractMetadataSchemaForKind('conductor.event').extend({
  eventId: z.string().min(1),
  timestamp: z.string().min(1),
  traceId: z.string().min(1),
  type: z.string().min(1),
  source: eventSourceSchema,
  payload: z.unknown(),
});

export const wiringPortRefSchema = z.object({
  moduleId: z.string().min(1),
  port: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
});

export const wiringToolTargetSchema = z.object({
  moduleId: z.string().min(1),
  tool: z.string().min(1),
  arg: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
});

export const wiringEdgeSchema = contractMetadataSchemaForKind('conductor.wiringEdge').extend({
  id: z.string().min(1),
  from: wiringPortRefSchema,
  to: wiringToolTargetSchema,
  enabled: z.boolean().default(true),
});

export const moduleManifestSchema = contractMetadataSchemaForKind('module.manifest').extend({
  id: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  views: z.array(moduleViewSchema).default([]),
  outputs: z.array(modulePortSchema).default([]),
  inputs: z.array(modulePortSchema).default([]),
  stateResources: z.array(z.string()).default([]),
  runtime: moduleRuntimeProfileSchema.default(defaultRuntimeProfile()),
});

export const moduleConnectionSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  manifest: moduleManifestSchema,
  profile: moduleRuntimeProfileSchema.optional(),
  transportAdapterId: z.string().optional(),
});

export const toolLikeSchema = z.object({
  name: z.string().min(1),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  _meta: z.record(z.unknown()).optional(),
});

export const resourceLikeSchema = z.object({
  uri: z.string().min(1),
  mimeType: z.string().optional(),
  _meta: z.record(z.unknown()).optional(),
});

export const promptLikeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const capabilityInventorySchema = z.object({
  tools: z.array(toolLikeSchema),
  resources: z.array(resourceLikeSchema),
  prompts: z.array(promptLikeSchema),
  discoveredAt: z.string().min(1),
});

export const mountedViewSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  toolName: z.string().min(1),
  resourceUri: z.string().min(1),
  mountPoint: displayModeSchema,
  createdAt: z.string().min(1),
});

export const registeredModuleSchema = moduleConnectionSchema.extend({
  status: z.enum(['registered', 'connected', 'rejected', 'error']),
  lastError: z.string().optional(),
});

export const moduleRegisteredPayloadSchema = z.object({
  module: registeredModuleSchema,
});

export const moduleRejectedPayloadSchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(1),
});

export const moduleErrorPayloadSchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(1),
});

export const moduleCapabilitiesPayloadSchema = z.object({
  moduleId: z.string().min(1),
  capabilities: capabilityInventorySchema,
});

export const viewMountedPayloadSchema = z.object({
  view: mountedViewSchema,
});

export const wiringConnectedPayloadSchema = z.object({
  edge: wiringEdgeSchema,
});

export const portEventPayloadSchema = z.object({
  moduleId: z.string().min(1),
  port: z.string().min(1),
  data: z.unknown(),
});

export const toolCallPayloadSchema = z.object({
  moduleId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.unknown()),
  edgeId: z.string().min(1).optional(),
});

export const toolResultPayloadSchema = z.object({
  moduleId: z.string().min(1),
  toolName: z.string().min(1),
  result: z.unknown(),
  edgeId: z.string().min(1).optional(),
});

export const swapPlanPayloadSchema = z.object({
  fromModuleId: z.string().min(1),
  toModuleId: z.string().min(1),
  requested: swapModeSchema,
  resolved: z.enum(['hot', 'warm', 'cold']),
  reasons: z.array(z.string()),
});

export const swapFallbackPayloadSchema = swapPlanPayloadSchema;

export const swapAppliedPayloadSchema = z.object({
  fromModuleId: z.string().min(1),
  toModuleId: z.string().min(1),
  edgeIds: z.array(z.string().min(1)),
});

export const wiringDecisionPayloadSchema = z.object({
  edge: wiringEdgeSchema,
  outcomes: z.array(validationOutcomeSchema),
});

export const eventPayloadSchemaMap = {
  'module.registered': moduleRegisteredPayloadSchema,
  'module.rejected': moduleRejectedPayloadSchema,
  'module.error': moduleErrorPayloadSchema,
  'module.capabilities': moduleCapabilitiesPayloadSchema,
  'view.mounted': viewMountedPayloadSchema,
  'wiring.connected': wiringConnectedPayloadSchema,
  'port.event': portEventPayloadSchema,
  'tool.call': toolCallPayloadSchema,
  'tool.result': toolResultPayloadSchema,
  'swap.plan': swapPlanPayloadSchema,
  'swap.fallback': swapFallbackPayloadSchema,
  'swap.applied': swapAppliedPayloadSchema,
  'validation.outcome': validationOutcomeSchema,
  'wiring.validate': wiringDecisionPayloadSchema,
  'wiring.reject': wiringDecisionPayloadSchema,
  'wiring.warn': wiringDecisionPayloadSchema,
  'wiring.accept': wiringDecisionPayloadSchema,
} as const;

export type KnownEventType = keyof typeof eventPayloadSchemaMap;

export function getEventPayloadSchema(type: string) {
  return eventPayloadSchemaMap[type as KnownEventType];
}

export const conductorStateSchema = z.object({
  modules: z.record(moduleConnectionSchema),
  wiring: z.array(wiringEdgeSchema),
  views: z.array(mountedViewSchema),
  events: z.array(eventEnvelopeSchema),
});

export const moduleProfileSchema = contractMetadataSchemaForKind('module.profile').extend({
  manifest: moduleManifestSchema,
  runtime: moduleRuntimeProfileSchema.default(defaultRuntimeProfile()),
  ports: z.object({
    outputs: z.array(modulePortSchema).default([]),
    inputs: z.array(modulePortSchema).default([]),
  }),
});

export type DisplayMode = z.infer<typeof displayModeSchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulePort = z.infer<typeof modulePortSchema>;
export type ModuleView = z.infer<typeof moduleViewSchema>;
export type TransportMode = z.infer<typeof transportModeSchema>;
export type StateModel = z.infer<typeof stateModelSchema>;
export type Affinity = z.infer<typeof affinitySchema>;
export type SwapMode = z.infer<typeof swapModeSchema>;
export type SwapSupport = z.infer<typeof swapSupportSchema>;
export type ModuleRuntimeProfile = z.infer<typeof moduleRuntimeProfileSchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
export type WiringEdge = z.infer<typeof wiringEdgeSchema>;
export type ModuleConnection = z.infer<typeof moduleConnectionSchema>;
export type ToolLike = z.infer<typeof toolLikeSchema>;
export type ResourceLike = z.infer<typeof resourceLikeSchema>;
export type PromptLike = z.infer<typeof promptLikeSchema>;
export type CapabilityInventory = z.infer<typeof capabilityInventorySchema>;
export type MountedView = z.infer<typeof mountedViewSchema>;
export type RegisteredModule = z.infer<typeof registeredModuleSchema>;
export type ModuleRegisteredPayload = z.infer<typeof moduleRegisteredPayloadSchema>;
export type ModuleRejectedPayload = z.infer<typeof moduleRejectedPayloadSchema>;
export type ModuleErrorPayload = z.infer<typeof moduleErrorPayloadSchema>;
export type ModuleCapabilitiesPayload = z.infer<typeof moduleCapabilitiesPayloadSchema>;
export type ViewMountedPayload = z.infer<typeof viewMountedPayloadSchema>;
export type WiringConnectedPayload = z.infer<typeof wiringConnectedPayloadSchema>;
export type PortEventPayload = z.infer<typeof portEventPayloadSchema>;
export type ToolCallPayload = z.infer<typeof toolCallPayloadSchema>;
export type ToolResultPayload = z.infer<typeof toolResultPayloadSchema>;
export type SwapPlanPayload = z.infer<typeof swapPlanPayloadSchema>;
export type SwapFallbackPayload = z.infer<typeof swapFallbackPayloadSchema>;
export type SwapAppliedPayload = z.infer<typeof swapAppliedPayloadSchema>;
export type WiringDecisionPayload = z.infer<typeof wiringDecisionPayloadSchema>;
export type ConductorState = z.infer<typeof conductorStateSchema>;
export type ModuleProfile = z.infer<typeof moduleProfileSchema>;
