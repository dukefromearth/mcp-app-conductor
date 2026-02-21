import { z } from 'zod';

export const displayModeSchema = z.enum(['main', 'sidebar', 'overlay', 'pip', 'fullscreen']);

export const moduleViewSchema = z.object({
  resourceUri: z.string().min(1),
  displayModes: z.array(displayModeSchema).nonempty()
});

export const modulePortSchema = z.object({
  name: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
  description: z.string().optional()
});

export const transportModeSchema = z.enum(['stateless', 'session']);
export const stateModelSchema = z.enum(['none', 'ephemeral', 'durable']);
export const affinitySchema = z.enum(['none', 'session', 'instance']);
export const swapModeSchema = z.enum(['hot', 'warm', 'cold', 'auto']);

export const swapSupportSchema = z.object({
  hot: z.boolean().default(false),
  warm: z.boolean().default(true),
  cold: z.literal(true).default(true)
});

export const moduleRuntimeProfileSchema = z.object({
  transportMode: transportModeSchema.default('stateless'),
  stateModel: stateModelSchema.default('none'),
  affinity: affinitySchema.default('none'),
  swapSupport: swapSupportSchema.default({ hot: false, warm: true, cold: true }),
  snapshotTool: z.string().min(1).optional(),
  restoreTool: z.string().min(1).optional()
});

export const eventSourceSchema = z.object({
  actor: z.enum(['conductor', 'host', 'module', 'agent', 'system']).default('system'),
  moduleId: z.string().optional(),
  viewId: z.string().optional(),
  operation: z.string().optional()
});

export const eventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  timestamp: z.string().min(1),
  traceId: z.string().min(1),
  type: z.string().min(1),
  source: eventSourceSchema,
  payload: z.unknown()
});

export const wiringPortRefSchema = z.object({
  moduleId: z.string().min(1),
  port: z.string().min(1),
  schema: z.record(z.unknown()).optional()
});

export const wiringToolTargetSchema = z.object({
  moduleId: z.string().min(1),
  tool: z.string().min(1),
  arg: z.string().min(1),
  schema: z.record(z.unknown()).optional()
});

export const wiringEdgeSchema = z.object({
  id: z.string().min(1),
  from: wiringPortRefSchema,
  to: wiringToolTargetSchema,
  enabled: z.boolean().default(true)
});

export const moduleManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  views: z.array(moduleViewSchema).default([]),
  outputs: z.array(modulePortSchema).default([]),
  inputs: z.array(modulePortSchema).default([]),
  stateResources: z.array(z.string()).default([]),
  runtime: moduleRuntimeProfileSchema.default({
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true }
  })
});

export const moduleConnectionSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  manifest: moduleManifestSchema,
  profile: moduleRuntimeProfileSchema.optional(),
  transportAdapterId: z.string().optional()
});

export const mountedViewSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  toolName: z.string().min(1),
  resourceUri: z.string().min(1),
  mountPoint: displayModeSchema,
  createdAt: z.string().min(1)
});

export const conductorStateSchema = z.object({
  modules: z.record(moduleConnectionSchema),
  wiring: z.array(wiringEdgeSchema),
  views: z.array(mountedViewSchema),
  events: z.array(eventEnvelopeSchema)
});

export const moduleProfileSchema = z.object({
  manifest: moduleManifestSchema,
  runtime: moduleRuntimeProfileSchema.default({
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true }
  }),
  ports: z.object({
    outputs: z.array(modulePortSchema).default([]),
    inputs: z.array(modulePortSchema).default([])
  })
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
export type MountedView = z.infer<typeof mountedViewSchema>;
export type ConductorState = z.infer<typeof conductorStateSchema>;
export type ModuleProfile = z.infer<typeof moduleProfileSchema>;
