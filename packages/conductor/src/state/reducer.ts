import type { EventEnvelope, MountedView, WiringEdge } from '@mcp-app-conductor/contracts';
import type { CapabilityInventory, ConductorSnapshot, RegisteredModule } from '../types';

export interface ConductorEventPayloadMap {
  'module.registered': { module: RegisteredModule };
  'module.rejected': { moduleId: string; reason: string };
  'module.error': { moduleId: string; reason: string };
  'module.capabilities': { moduleId: string; capabilities: CapabilityInventory };
  'wiring.connected': { edge: WiringEdge };
  'view.mounted': { view: MountedView };
  'swap.applied': { fromModuleId: string; toModuleId: string; edgeIds: string[] };
}

function pushEvent(events: EventEnvelope[], event: EventEnvelope): EventEnvelope[] {
  const next = [...events, event];
  if (next.length > 5_000) {
    return next.slice(next.length - 5_000);
  }

  return next;
}

export function reduceState(state: ConductorSnapshot, event: EventEnvelope): ConductorSnapshot {
  const next: ConductorSnapshot = {
    modules: { ...state.modules },
    capabilityInventory: { ...state.capabilityInventory },
    wiring: [...state.wiring],
    views: [...state.views],
    events: pushEvent(state.events, event),
  };

  const payload = event.payload as ConductorEventPayloadMap[keyof ConductorEventPayloadMap] | undefined;

  switch (event.type) {
    case 'module.registered': {
      const typed = payload as ConductorEventPayloadMap['module.registered'];
      next.modules[typed.module.id] = typed.module;
      break;
    }
    case 'module.rejected': {
      const typed = payload as ConductorEventPayloadMap['module.rejected'];
      const existing = next.modules[typed.moduleId];
      if (existing) {
        next.modules[typed.moduleId] = {
          ...existing,
          status: 'rejected',
          lastError: typed.reason,
        };
      }
      break;
    }
    case 'module.error': {
      const typed = payload as ConductorEventPayloadMap['module.error'];
      const existing = next.modules[typed.moduleId];
      if (existing) {
        next.modules[typed.moduleId] = {
          ...existing,
          status: 'error',
          lastError: typed.reason,
        };
      }
      break;
    }
    case 'module.capabilities': {
      const typed = payload as ConductorEventPayloadMap['module.capabilities'];
      next.capabilityInventory[typed.moduleId] = typed.capabilities;
      const existing = next.modules[typed.moduleId];
      if (existing) {
        next.modules[typed.moduleId] = {
          ...existing,
          status: 'connected',
          lastError: undefined,
        };
      }
      break;
    }
    case 'wiring.connected': {
      const typed = payload as ConductorEventPayloadMap['wiring.connected'];
      const index = next.wiring.findIndex((edge) => edge.id === typed.edge.id);
      if (index >= 0) {
        next.wiring[index] = typed.edge;
      } else {
        next.wiring.push(typed.edge);
      }
      break;
    }
    case 'view.mounted': {
      const typed = payload as ConductorEventPayloadMap['view.mounted'];
      next.views.push(typed.view);
      break;
    }
    case 'swap.applied': {
      break;
    }
    default:
      break;
  }

  return next;
}
