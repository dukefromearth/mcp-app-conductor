import type { ModuleRuntimeProfile } from '@mcp-app-conductor/contracts';

export interface TransportAdapter {
  id: string;
  description?: string;
  supports(profile: ModuleRuntimeProfile): boolean;
}

export function getAdapter(
  adapters: Map<string, TransportAdapter>,
  adapterId?: string,
): TransportAdapter | undefined {
  if (!adapterId) {
    return undefined;
  }

  return adapters.get(adapterId);
}
