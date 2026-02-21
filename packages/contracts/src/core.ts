import { z } from 'zod';

export const CONTRACT_VERSION = '1.0.0';
export const SUPPORTED_CONTRACT_MAJOR = 1;

const semverPattern = /^\d+\.\d+\.\d+$/;

export const kindValues = [
  'module.manifest',
  'module.runtimeProfile',
  'module.profile',
  'conductor.event',
  'conductor.wiringEdge',
  'canvas.runtimeConfig',
  'canvas.persistedModule',
] as const;

export const kindSchema = z.enum(kindValues);

export type Kind = z.infer<typeof kindSchema>;

export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  if (!semverPattern.test(version)) {
    return null;
  }

  const [majorText, minorText, patchText] = version.split('.');
  const major = Number.parseInt(majorText, 10);
  const minor = Number.parseInt(minorText, 10);
  const patch = Number.parseInt(patchText, 10);

  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }

  return { major, minor, patch };
}

export function isSupportedContractVersion(version: string): boolean {
  const parsed = parseSemver(version);
  if (!parsed) {
    return false;
  }

  return parsed.major === SUPPORTED_CONTRACT_MAJOR;
}

export const contractVersionSchema = z
  .string()
  .regex(semverPattern, 'contractVersion must be semver (e.g. 1.0.0)')
  .refine(
    (value) => isSupportedContractVersion(value),
    `Unsupported contractVersion major. Expected ${SUPPORTED_CONTRACT_MAJOR}.x.x`,
  );

export const contractMetadataSchema = z.object({
  contractVersion: contractVersionSchema,
  kind: kindSchema,
  extensions: z.record(z.unknown()),
});

export function contractMetadataSchemaForKind<K extends Kind>(kind: K) {
  return z.object({
    contractVersion: contractVersionSchema,
    kind: z.literal(kind),
    extensions: z.record(z.unknown()),
  });
}

export type ContractMetadata = z.infer<typeof contractMetadataSchema>;
export type SupportedContractVersion = z.infer<typeof contractVersionSchema>;
