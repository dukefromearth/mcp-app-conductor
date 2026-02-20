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

export const moduleManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  views: z.array(moduleViewSchema).default([]),
  outputs: z.array(modulePortSchema).default([]),
  inputs: z.array(modulePortSchema).default([]),
  stateResources: z.array(z.string()).default([])
});

export type DisplayMode = z.infer<typeof displayModeSchema>;
export type ModuleManifest = z.infer<typeof moduleManifestSchema>;
export type ModulePort = z.infer<typeof modulePortSchema>;
export type ModuleView = z.infer<typeof moduleViewSchema>;
