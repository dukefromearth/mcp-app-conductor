import { z } from 'zod';

export const validationModeSchema = z.enum(['observe', 'warn', 'enforce']);

export const validationBoundarySchema = z.enum([
  'cli.runtimeConfig',
  'cli.profile',
  'cli.flags',
  'host.mountArgs',
  'host.wireInput',
  'conductor.wiringEdge',
  'conductor.eventPayload',
  'conductor.portSignal',
]);

export const validationPolicySchema = z.object({
  'cli.runtimeConfig': validationModeSchema,
  'cli.profile': validationModeSchema,
  'cli.flags': validationModeSchema,
  'host.mountArgs': validationModeSchema,
  'host.wireInput': validationModeSchema,
  'conductor.wiringEdge': validationModeSchema,
  'conductor.eventPayload': validationModeSchema,
  'conductor.portSignal': validationModeSchema,
});

export const defaultValidationPolicy = validationPolicySchema.parse({
  'cli.runtimeConfig': 'enforce',
  'cli.profile': 'enforce',
  'cli.flags': 'enforce',
  'host.mountArgs': 'enforce',
  'host.wireInput': 'enforce',
  'conductor.wiringEdge': 'enforce',
  'conductor.eventPayload': 'warn',
  'conductor.portSignal': 'warn',
});

export const validationIssueSchema = z.object({
  path: z.string().min(1),
  message: z.string().min(1),
  code: z.string().min(1),
});

export const validationOutcomeSchema = z.object({
  boundary: validationBoundarySchema,
  mode: validationModeSchema,
  ok: z.boolean(),
  message: z.string().min(1),
  issues: z.array(validationIssueSchema).default([]),
});

export const portSignalSchema = z.object({
  moduleId: z.string().min(1),
  port: z.string().min(1),
  data: z.unknown(),
  traceId: z.string().min(1).optional(),
});

export const mountArgsSchema = z.object({}).catchall(z.unknown());

export const modulePortSpecifierSchema = z
  .string()
  .min(3)
  .regex(/^[^:]+:[^:]+$/, 'Expected module:port');

export const moduleToolArgSpecifierSchema = z
  .string()
  .min(5)
  .regex(/^[^:]+:[^:]+:[^:]+$/, 'Expected module:tool:arg');

export type ValidationMode = z.infer<typeof validationModeSchema>;
export type ValidationBoundary = z.infer<typeof validationBoundarySchema>;
export type ValidationPolicy = z.infer<typeof validationPolicySchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationOutcome = z.infer<typeof validationOutcomeSchema>;
export type PortSignalInput = z.infer<typeof portSignalSchema>;
