import type {
  DisplayMode,
  EventEnvelope,
  ModuleConnection,
  ModuleManifest,
  ModuleRuntimeProfile,
  MountedView,
  SwapMode,
  ValidationOutcome,
  ValidationPolicy,
  WiringEdge
} from '@mcp-app-conductor/contracts';

export interface ToolLike {
  name: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface ResourceLike {
  uri: string;
  mimeType?: string;
  _meta?: Record<string, unknown>;
}

export interface PromptLike {
  name: string;
  description?: string;
}

export interface CapabilityInventory {
  tools: ToolLike[];
  resources: ResourceLike[];
  prompts: PromptLike[];
  discoveredAt: string;
}

export interface RegisteredModule extends ModuleConnection {
  status: 'registered' | 'connected' | 'rejected' | 'error';
  lastError?: string;
}

export interface ConductorSnapshot {
  modules: Record<string, RegisteredModule>;
  capabilityInventory: Record<string, CapabilityInventory>;
  wiring: WiringEdge[];
  views: MountedView[];
  events: EventEnvelope[];
}

export interface MountViewRequest {
  moduleId: string;
  toolName: string;
  args?: Record<string, unknown>;
  mountPoint: DisplayMode;
}

export interface MountedViewResult {
  view: MountedView;
  html: string;
  csp?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  toolResult: unknown;
}

export interface ModuleRegistrationRequest {
  id: string;
  url: string;
  manifest: ModuleManifest;
  profile?: ModuleRuntimeProfile;
  transportAdapterId?: string;
}

export interface SwapRequest {
  fromModuleId: string;
  toModuleId: string;
  mode?: SwapMode;
}

export interface SwapPlan {
  requested: SwapMode;
  resolved: Exclude<SwapMode, 'auto'>;
  reasons: string[];
  fallbackUsed: boolean;
}

export interface RoutedAction {
  edgeId: string;
  moduleId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface PortSignal {
  moduleId: string;
  port: string;
  data: unknown;
  traceId?: string;
}

export type ValidationOutcomeInput = ValidationOutcome;
export type ConductorValidationPolicy = ValidationPolicy;

export interface StoreMetrics {
  dispatchCount: number;
  eventCount: number;
  lastValidationDispatch: number;
  lastGetStateDurationMs: number;
  lastSnapshotBytes: number;
}

export interface ConductorEventListener {
  (event: EventEnvelope, state: ConductorSnapshot): void;
}
