import type { ModuleRuntimeProfile, SwapMode } from '@mcp-app-conductor/contracts';
import type { SwapPlan } from '../types';

function supportsHot(profile: ModuleRuntimeProfile): boolean {
  return Boolean(profile.swapSupport.hot && profile.snapshotTool && profile.restoreTool);
}

function supportsWarm(profile: ModuleRuntimeProfile): boolean {
  return Boolean(profile.swapSupport.warm);
}

function toResolved(mode: SwapMode): Exclude<SwapMode, 'auto'> {
  return mode === 'auto' ? 'cold' : mode;
}

export function resolveSwapPlan(
  fromProfile: ModuleRuntimeProfile,
  toProfile: ModuleRuntimeProfile,
  requested: SwapMode = 'auto',
): SwapPlan {
  const reasons: string[] = [];
  let resolved: Exclude<SwapMode, 'auto'>;

  const fromHot = supportsHot(fromProfile);
  const toHot = supportsHot(toProfile);
  const fromWarm = supportsWarm(fromProfile);
  const toWarm = supportsWarm(toProfile);

  if (requested === 'auto') {
    if (fromHot && toHot) {
      resolved = 'hot';
      reasons.push('Both modules advertise hot swap and snapshot/restore tools.');
    } else if (fromWarm && toWarm) {
      resolved = 'warm';
      reasons.push('Hot swap not available; both modules support warm swap.');
    } else {
      resolved = 'cold';
      reasons.push('Falling back to cold swap due to incompatible runtime capabilities.');
    }

    return {
      requested,
      resolved,
      reasons,
      fallbackUsed: resolved !== 'hot',
    };
  }

  resolved = toResolved(requested);

  if (resolved === 'hot' && !(fromHot && toHot)) {
    if (fromWarm && toWarm) {
      reasons.push('Requested hot swap but one/both modules cannot snapshot/restore; using warm swap.');
      resolved = 'warm';
    } else {
      reasons.push('Requested hot swap but hot/warm unsupported; using cold swap.');
      resolved = 'cold';
    }
  }

  if (resolved === 'warm' && !(fromWarm && toWarm)) {
    reasons.push('Requested warm swap but warm unsupported; using cold swap.');
    resolved = 'cold';
  }

  if (reasons.length === 0) {
    reasons.push(`Swap mode ${resolved} is supported by both modules.`);
  }

  return {
    requested,
    resolved,
    reasons,
    fallbackUsed: resolved !== toResolved(requested),
  };
}
