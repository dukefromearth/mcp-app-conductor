import { conductorStateSchema, eventEnvelopeSchema } from '@mcp-app-conductor/contracts';
import type { EventEnvelope } from '@mcp-app-conductor/contracts';
import type { ConductorEventListener, ConductorSnapshot } from '../types';
import { reduceState } from './reducer';

function createInitialState(): ConductorSnapshot {
  return {
    modules: {},
    capabilityInventory: {},
    wiring: [],
    views: [],
    events: [],
  };
}

export class ConductorStore {
  private state: ConductorSnapshot;
  private readonly listeners: Set<ConductorEventListener>;

  constructor() {
    this.state = createInitialState();
    this.listeners = new Set();
  }

  dispatch(event: EventEnvelope): ConductorSnapshot {
    const parsedEvent = eventEnvelopeSchema.parse(event);
    this.state = reduceState(this.state, parsedEvent);
    this.listeners.forEach((listener) => listener(parsedEvent, this.getState()));
    return this.getState();
  }

  subscribe(listener: ConductorEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ConductorSnapshot {
    const snapshot = JSON.parse(JSON.stringify(this.state)) as ConductorSnapshot;

    // Keep schema compatibility for the public contract and detect accidental drift.
    conductorStateSchema.parse({
      modules: Object.fromEntries(
        Object.entries(snapshot.modules).map(([id, module]) => [id, {
          id: module.id,
          url: module.url,
          manifest: module.manifest,
          profile: module.profile,
          transportAdapterId: module.transportAdapterId,
        }])
      ),
      wiring: snapshot.wiring,
      views: snapshot.views,
      events: snapshot.events,
    });

    return snapshot;
  }
}
