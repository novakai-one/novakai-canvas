import type { Layout, PlacedNode } from '../../interaction/reveal-tree';
import { field } from '../../object-graph/graph';
import { stageBoundsForTier, type MissionZoomTier } from './mission-semantic-zoom';

export type MissionStageProminence = 'landmark' | 'pressure' | 'settled' | 'receding' | 'nested';

export type MissionHeroProjection = {
  readonly x: number;
  readonly y: number;
  readonly prominence: MissionStageProminence;
  readonly scale: number;
};

const ROOT_START_X = 260;
const ROOT_SWEEP_X = 185;
const DEPTH_STEP_X = 540;

function rootOf(placed: PlacedNode, byId: ReadonlyMap<string, PlacedNode>): PlacedNode {
  let current = placed;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

function prominenceFor(placed: PlacedNode): MissionStageProminence {
  if (placed.depth > 0) return 'nested';
  switch (field(placed.record, 'status')) {
    case 'active': return 'landmark';
    case 'blocked': return 'pressure';
    case 'done': return 'settled';
    default: return 'receding';
  }
}

function scaleFor(prominence: MissionStageProminence, tier: MissionZoomTier, selected: boolean): number {
  if (selected) return tier === 'detail' ? 1.06 : 1.12;
  if (tier === 'overview') {
    return prominence === 'landmark' ? 1.16 : prominence === 'pressure' ? 1.02 : 0.82;
  }
  if (tier === 'detail') {
    return prominence === 'landmark' ? 1.1 : prominence === 'receding' ? 0.9 : 0.98;
  }
  switch (prominence) {
    case 'landmark': return 1.26;
    case 'pressure': return 1.08;
    case 'settled': return 0.88;
    case 'nested': return 0.92;
    default: return 0.8;
  }
}

/** Visual-only projection: domain layout remains untouched and continues to own relationships. */
export function missionHeroProjection(
  placed: PlacedNode,
  layout: Layout,
  tier: MissionZoomTier,
  selected: boolean,
): MissionHeroProjection {
  const byId = new Map(layout.nodes.map((node) => [node.record.id, node]));
  const root = rootOf(placed, byId);
  const prominence = prominenceFor(placed);
  return {
    x: ROOT_START_X + root.siblingIndex * ROOT_SWEEP_X + placed.depth * DEPTH_STEP_X,
    y: placed.y + placed.depth * 12,
    prominence,
    scale: scaleFor(prominence, tier, selected),
  };
}

export function missionHeroBounds(
  placed: PlacedNode,
  layout: Layout,
  tier: MissionZoomTier,
  selected: boolean,
) {
  const projection = missionHeroProjection(placed, layout, tier, selected);
  const base = stageBoundsForTier(tier);
  return {
    width: Math.round(base.width * projection.scale),
    height: Math.round(base.height * projection.scale),
  };
}
