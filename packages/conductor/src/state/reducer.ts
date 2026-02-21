import {
  moduleCapabilitiesPayloadSchema,
  moduleErrorPayloadSchema,
  moduleRegisteredPayloadSchema,
  moduleRejectedPayloadSchema,
  viewMountedPayloadSchema,
  wiringConnectedPayloadSchema,
  type EventEnvelope,
} from '@mcp-app-conductor/contracts';
import type { ConductorSnapshot } from '../types';

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

  switch (event.type) {
    case 'module.registered': {
      const parsed = moduleRegisteredPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
      next.modules[typed.module.id] = typed.module;
      break;
    }
    case 'module.rejected': {
      const parsed = moduleRejectedPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
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
      const parsed = moduleErrorPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
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
      const parsed = moduleCapabilitiesPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
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
      const parsed = wiringConnectedPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
      const index = next.wiring.findIndex((edge) => edge.id === typed.edge.id);
      if (index >= 0) {
        next.wiring[index] = typed.edge;
      } else {
        next.wiring.push(typed.edge);
      }
      break;
    }
    case 'view.mounted': {
      const parsed = viewMountedPayloadSchema.safeParse(event.payload);
      if (!parsed.success) {
        break;
      }

      const typed = parsed.data;
      next.views.push(typed.view);
      break;
    }
    case 'swap.applied': {
      break;
    }
    case 'validation.outcome': {
      break;
    }
    default:
      break;
  }

  return next;
}
