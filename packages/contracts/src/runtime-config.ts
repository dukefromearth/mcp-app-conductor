import { z } from 'zod';
import { CONTRACT_VERSION, contractMetadataSchemaForKind } from './core.js';
import { moduleManifestSchema, moduleRuntimeProfileSchema, wiringEdgeSchema } from './artifacts.js';
import { defaultValidationPolicy, validationIssueSchema, validationPolicySchema } from './validation.js';

export const persistedModuleSchema = contractMetadataSchemaForKind('canvas.persistedModule').extend({
  id: z.string().min(1),
  url: z.string().url(),
  manifest: moduleManifestSchema,
  profile: moduleRuntimeProfileSchema.optional(),
  transportAdapterId: z.string().optional(),
});

export const runtimeConfigSchema = contractMetadataSchemaForKind('canvas.runtimeConfig').extend({
  modules: z.record(persistedModuleSchema).default({}),
  wiring: z.array(wiringEdgeSchema).default([]),
  traceFile: z.string().min(1),
  validationPolicy: validationPolicySchema.default(defaultValidationPolicy),
});

const legacyModuleRuntimeProfileSchema = z.object({
  transportMode: z.enum(['stateless', 'session']).default('stateless'),
  stateModel: z.enum(['none', 'ephemeral', 'durable']).default('none'),
  affinity: z.enum(['none', 'session', 'instance']).default('none'),
  swapSupport: z.object({
    hot: z.boolean().default(false),
    warm: z.boolean().default(true),
    cold: z.literal(true).default(true),
  }).default({ hot: false, warm: true, cold: true }),
  snapshotTool: z.string().min(1).optional(),
  restoreTool: z.string().min(1).optional(),
});

const legacyModuleManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  views: z.array(z.object({
    resourceUri: z.string().min(1),
    displayModes: z.array(z.enum(['main', 'sidebar', 'overlay', 'pip', 'fullscreen'])).nonempty(),
  })).default([]),
  outputs: z.array(z.object({
    name: z.string().min(1),
    schema: z.record(z.unknown()).optional(),
    description: z.string().optional(),
  })).default([]),
  inputs: z.array(z.object({
    name: z.string().min(1),
    schema: z.record(z.unknown()).optional(),
    description: z.string().optional(),
  })).default([]),
  stateResources: z.array(z.string()).default([]),
  runtime: legacyModuleRuntimeProfileSchema.default({
    transportMode: 'stateless',
    stateModel: 'none',
    affinity: 'none',
    swapSupport: { hot: false, warm: true, cold: true },
  }),
});

export const legacyPersistedModuleSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  manifest: legacyModuleManifestSchema,
  profile: legacyModuleRuntimeProfileSchema.optional(),
  transportAdapterId: z.string().optional(),
});

export const legacyWiringEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.object({
    moduleId: z.string().min(1),
    port: z.string().min(1),
    schema: z.record(z.unknown()).optional(),
  }),
  to: z.object({
    moduleId: z.string().min(1),
    tool: z.string().min(1),
    arg: z.string().min(1),
    schema: z.record(z.unknown()).optional(),
  }),
  enabled: z.boolean().default(true),
});

export const legacyRuntimeConfigSchema = z.object({
  modules: z.record(legacyPersistedModuleSchema).default({}),
  wiring: z.array(legacyWiringEdgeSchema).default([]),
  traceFile: z.string().min(1),
});

export const runtimeConfigMigrationResultSchema = z.object({
  migrated: z.boolean(),
  warnings: z.array(validationIssueSchema),
  runtimeConfig: runtimeConfigSchema,
});

export function createDefaultRuntimeConfig(traceFile: string) {
  return runtimeConfigSchema.parse({
    contractVersion: CONTRACT_VERSION,
    kind: 'canvas.runtimeConfig',
    extensions: {},
    modules: {},
    wiring: [],
    traceFile,
    validationPolicy: defaultValidationPolicy,
  });
}

function normalizeRuntimeProfile(input: z.input<typeof legacyModuleRuntimeProfileSchema>) {
  const parsed = legacyModuleRuntimeProfileSchema.parse(input);
  return moduleRuntimeProfileSchema.parse({
    contractVersion: CONTRACT_VERSION,
    kind: 'module.runtimeProfile',
    extensions: {},
    transportMode: parsed.transportMode,
    stateModel: parsed.stateModel,
    affinity: parsed.affinity,
    swapSupport: parsed.swapSupport,
    snapshotTool: parsed.snapshotTool,
    restoreTool: parsed.restoreTool,
  });
}

function normalizeManifest(input: z.input<typeof legacyModuleManifestSchema>) {
  const parsed = legacyModuleManifestSchema.parse(input);
  return moduleManifestSchema.parse({
    contractVersion: CONTRACT_VERSION,
    kind: 'module.manifest',
    extensions: {},
    id: parsed.id,
    version: parsed.version,
    displayName: parsed.displayName,
    views: parsed.views,
    outputs: parsed.outputs,
    inputs: parsed.inputs,
    stateResources: parsed.stateResources,
    runtime: normalizeRuntimeProfile(parsed.runtime),
  });
}

export function migrateRuntimeConfig(input: unknown) {
  const asRuntime = runtimeConfigSchema.safeParse(input);
  if (asRuntime.success) {
    return runtimeConfigMigrationResultSchema.parse({
      migrated: false,
      warnings: [],
      runtimeConfig: asRuntime.data,
    });
  }

  const asLegacy = legacyRuntimeConfigSchema.safeParse(input);
  if (!asLegacy.success) {
    throw asRuntime.error;
  }

  const legacy = asLegacy.data;
  const warnings: z.infer<typeof validationIssueSchema>[] = [];
  warnings.push({
    path: '<root>',
    message: 'Legacy runtime config detected and migrated to Contract Spine v1.',
    code: 'legacy_runtime_config_migrated',
  });
  warnings.push({
    path: 'contractVersion',
    message: `Set contractVersion to ${CONTRACT_VERSION}.`,
    code: 'field_added',
  });
  warnings.push({
    path: 'kind',
    message: 'Set kind to "canvas.runtimeConfig".',
    code: 'field_added',
  });
  warnings.push({
    path: 'extensions',
    message: 'Added required extensions field.',
    code: 'field_added',
  });

  const modules = Object.fromEntries(
    Object.entries(legacy.modules).map(([id, module]) => {
      const manifest = normalizeManifest(module.manifest);
      const profile = module.profile ? normalizeRuntimeProfile(module.profile) : undefined;

      return [id, persistedModuleSchema.parse({
        contractVersion: CONTRACT_VERSION,
        kind: 'canvas.persistedModule',
        extensions: {},
        id: module.id,
        url: module.url,
        manifest,
        profile,
        transportAdapterId: module.transportAdapterId,
      })];
    }),
  );

  const wiring = legacy.wiring.map((edge) => wiringEdgeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    kind: 'conductor.wiringEdge',
    extensions: {},
    id: edge.id,
    from: edge.from,
    to: edge.to,
    enabled: edge.enabled,
  }));

  return runtimeConfigMigrationResultSchema.parse({
    migrated: true,
    warnings,
    runtimeConfig: {
      contractVersion: CONTRACT_VERSION,
      kind: 'canvas.runtimeConfig',
      extensions: {},
      modules,
      wiring,
      traceFile: legacy.traceFile,
      validationPolicy: defaultValidationPolicy,
    },
  });
}

export type PersistedModule = z.infer<typeof persistedModuleSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
export type LegacyPersistedModule = z.infer<typeof legacyPersistedModuleSchema>;
export type LegacyRuntimeConfig = z.infer<typeof legacyRuntimeConfigSchema>;
export type RuntimeConfigMigrationResult = z.infer<typeof runtimeConfigMigrationResultSchema>;
