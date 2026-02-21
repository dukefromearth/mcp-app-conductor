import {
  portEventPayloadSchema,
  validationOutcomeSchema,
  type EventEnvelope,
  type ValidationMode,
  type ValidationOutcome,
  type WiringEdge,
} from '@mcp-app-conductor/contracts';
import type { RoutedAction } from '../types';

interface RouteOptions {
  mode: ValidationMode;
  onValidationOutcome?: (outcome: ValidationOutcome) => void;
}

function createOutcome(
  mode: ValidationMode,
  message: string,
  issues: ValidationOutcome['issues'],
): ValidationOutcome {
  return validationOutcomeSchema.parse({
    boundary: 'conductor.portSignal',
    mode,
    ok: false,
    message,
    issues,
  });
}

function schemaType(schema: unknown): string | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const value = (schema as Record<string, unknown>).type;
  return typeof value === 'string' ? value : undefined;
}

function validateValueAgainstSchema(value: unknown, schema?: Record<string, unknown>): boolean {
  if (!schema) {
    return true;
  }

  const type = schemaType(schema);
  if (!type) {
    return true;
  }

  if (type === 'string') {
    return typeof value === 'string';
  }

  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (type === 'integer') {
    return typeof value === 'number' && Number.isInteger(value);
  }

  if (type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (type === 'array') {
    return Array.isArray(value);
  }

  if (type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  return true;
}

function handleEdgeValidationFailure(
  options: RouteOptions,
  outcome: ValidationOutcome,
): void {
  options.onValidationOutcome?.(outcome);

  if (options.mode === 'enforce') {
    throw new Error(outcome.message);
  }
}

export function routePortEventToActions(
  event: EventEnvelope,
  edges: WiringEdge[],
  options: RouteOptions,
): RoutedAction[] {
  if (event.type !== 'port.event') {
    return [];
  }

  const parsedPayload = portEventPayloadSchema.safeParse(event.payload);
  if (!parsedPayload.success) {
    const outcome = createOutcome(
      options.mode,
      'Port event payload failed validation before routing.',
      parsedPayload.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
        message: issue.message,
        code: issue.code,
      })),
    );

    handleEdgeValidationFailure(options, outcome);
    return [];
  }

  const payload = parsedPayload.data;

  return edges
    .filter((edge) => edge.enabled)
    .filter((edge) => edge.from.moduleId === payload.moduleId)
    .filter((edge) => edge.from.port === payload.port)
    .flatMap((edge) => {
      const sourceValid = validateValueAgainstSchema(payload.data, edge.from.schema);
      const targetValid = validateValueAgainstSchema(payload.data, edge.to.schema);

      if (!sourceValid || !targetValid) {
        const outcome = createOutcome(
          options.mode,
          `Edge ${edge.id} rejected event payload due to schema mismatch.`,
          [{
            path: sourceValid ? `edge.${edge.id}.to.schema` : `edge.${edge.id}.from.schema`,
            message: 'Payload value does not satisfy the declared edge schema.',
            code: 'schema_mismatch',
          }],
        );
        handleEdgeValidationFailure(options, outcome);

        if (options.mode === 'observe') {
          return [{
            edgeId: edge.id,
            moduleId: edge.to.moduleId,
            toolName: edge.to.tool,
            args: {
              [edge.to.arg]: payload.data,
            },
          }];
        }

        return [];
      }

      return [{
        edgeId: edge.id,
        moduleId: edge.to.moduleId,
        toolName: edge.to.tool,
        args: {
          [edge.to.arg]: payload.data,
        },
      }];
    });
}
