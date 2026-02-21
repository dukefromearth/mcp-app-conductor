import {
  CONTRACT_VERSION,
  conductorStateSchema,
  eventEnvelopeSchema,
  getEventPayloadSchema,
  validationModeSchema,
  validationOutcomeSchema,
  type ValidationMode,
} from '@mcp-app-conductor/contracts';
import type { EventEnvelope } from '@mcp-app-conductor/contracts';
import type { ConductorEventListener, ConductorSnapshot, StoreMetrics } from '../types';
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
  private dispatchCount: number;
  private readonly validateStateEvery: number;
  private readonly eventPayloadMode: ValidationMode;
  private lastValidationDispatch: number;
  private snapshotVersion: number;
  private cacheVersion: number;
  private cachedSnapshot: ConductorSnapshot | null;
  private lastGetStateDurationMs: number;
  private lastSnapshotBytes: number;

  constructor(options: { validateStateEvery?: number; eventPayloadMode?: ValidationMode } = {}) {
    this.state = createInitialState();
    this.listeners = new Set();
    this.dispatchCount = 0;
    this.validateStateEvery = Math.max(1, options.validateStateEvery ?? 250);
    this.eventPayloadMode = validationModeSchema.parse(options.eventPayloadMode ?? 'warn');
    this.lastValidationDispatch = 0;
    this.snapshotVersion = 0;
    this.cacheVersion = -1;
    this.cachedSnapshot = null;
    this.lastGetStateDurationMs = 0;
    this.lastSnapshotBytes = 0;
  }

  private notify(parsedEvent: EventEnvelope): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(parsedEvent, snapshot));
  }

  private toValidationOutcomeEvent(
    sourceEvent: EventEnvelope,
    issues: Array<{ path: Array<string | number>; message: string; code: string }>,
  ): EventEnvelope {
    const payload = validationOutcomeSchema.parse({
      boundary: 'conductor.eventPayload',
      mode: this.eventPayloadMode,
      ok: false,
      message: `Event payload failed validation for type "${sourceEvent.type}".`,
      issues: issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
        message: issue.message,
        code: issue.code,
      })),
    });

    return eventEnvelopeSchema.parse({
      contractVersion: CONTRACT_VERSION,
      kind: 'conductor.event',
      extensions: {},
      eventId: `evt-payload-${sourceEvent.eventId}`,
      timestamp: new Date().toISOString(),
      traceId: sourceEvent.traceId,
      type: 'validation.outcome',
      source: {
        actor: 'conductor',
        moduleId: sourceEvent.source.moduleId,
        viewId: sourceEvent.source.viewId,
        operation: `validateEventPayload:${sourceEvent.type}`,
      },
      payload,
    });
  }

  private applyEvent(parsedEvent: EventEnvelope): void {
    this.state = reduceState(this.state, parsedEvent);
    this.dispatchCount += 1;
    this.snapshotVersion += 1;
    this.cachedSnapshot = null;

    if (this.dispatchCount - this.lastValidationDispatch >= this.validateStateEvery) {
      this.validatePublicContract(this.state);
      this.lastValidationDispatch = this.dispatchCount;
    }

    this.notify(parsedEvent);
  }

  private validatePublicContract(state: ConductorSnapshot): void {
    conductorStateSchema.parse({
      modules: Object.fromEntries(
        Object.entries(state.modules).map(([id, module]) => [id, {
          id: module.id,
          url: module.url,
          manifest: module.manifest,
          profile: module.profile,
          transportAdapterId: module.transportAdapterId,
        }]),
      ),
      wiring: state.wiring,
      views: state.views,
      events: state.events,
    });
  }

  dispatch(event: EventEnvelope): ConductorSnapshot {
    const parsedEvent = eventEnvelopeSchema.parse(event);
    const payloadSchema = getEventPayloadSchema(parsedEvent.type);

    if (payloadSchema) {
      const parsedPayload = payloadSchema.safeParse(parsedEvent.payload);
      if (!parsedPayload.success) {
        const outcomeEvent = this.toValidationOutcomeEvent(parsedEvent, parsedPayload.error.issues);
        this.applyEvent(outcomeEvent);

        if (this.eventPayloadMode === 'enforce') {
          throw new Error(`Event payload validation failed for ${parsedEvent.type}.`);
        }

        return this.getState();
      }
    }

    this.applyEvent(parsedEvent);
    return this.getState();
  }

  subscribe(listener: ConductorEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ConductorSnapshot {
    const startedAt = Date.now();

    if (this.cachedSnapshot && this.cacheVersion === this.snapshotVersion) {
      this.lastGetStateDurationMs = Date.now() - startedAt;
      return this.cachedSnapshot;
    }

    const snapshot: ConductorSnapshot = {
      modules: { ...this.state.modules },
      capabilityInventory: { ...this.state.capabilityInventory },
      wiring: [...this.state.wiring],
      views: [...this.state.views],
      events: [...this.state.events],
    };

    this.cachedSnapshot = snapshot;
    this.cacheVersion = this.snapshotVersion;
    this.lastGetStateDurationMs = Date.now() - startedAt;
    this.lastSnapshotBytes = snapshot.events.length * 220;

    return snapshot;
  }

  getMetrics(): StoreMetrics {
    return {
      dispatchCount: this.dispatchCount,
      eventCount: this.state.events.length,
      lastValidationDispatch: this.lastValidationDispatch,
      lastGetStateDurationMs: this.lastGetStateDurationMs,
      lastSnapshotBytes: this.lastSnapshotBytes,
    };
  }
}
