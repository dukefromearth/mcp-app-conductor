import { z } from 'zod';
import { CONTRACT_VERSION, contractMetadataSchemaForKind } from './core.js';
import { moduleManifestSchema, moduleRuntimeProfileSchema, wiringEdgeSchema } from './artifacts.js';
import { defaultValidationPolicy, validationPolicySchema } from './validation.js';

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

export type PersistedModule = z.infer<typeof persistedModuleSchema>;
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
