import type { EventEnvelope, WiringEdge } from '@mcp-app-conductor/contracts';
import type { RoutedAction } from '../types';

interface PortEventPayload {
  moduleId: string;
  port: string;
  data: unknown;
}

export function routePortEventToActions(event: EventEnvelope, edges: WiringEdge[]): RoutedAction[] {
  if (event.type !== 'port.event') {
    return [];
  }

  const payload = event.payload as PortEventPayload;

  return edges
    .filter((edge) => edge.enabled)
    .filter((edge) => edge.from.moduleId === payload.moduleId)
    .filter((edge) => edge.from.port === payload.port)
    .map((edge) => ({
      edgeId: edge.id,
      moduleId: edge.to.moduleId,
      toolName: edge.to.tool,
      args: {
        [edge.to.arg]: payload.data,
      },
    }));
}
