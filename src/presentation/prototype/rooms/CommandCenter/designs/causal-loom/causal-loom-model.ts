import type { AttentionItem, AttentionReason } from '../../../../attention/feed';
import type { ObjectId, ObjectKind, ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';

export type LoomPoint = { x: number; y: number };
export type LoomZoomTier = 'overview' | 'working' | 'detail';

export type LoomSpindle = {
  readonly id: string;
  readonly mission: ObjectRecord | null;
  readonly title: string;
  readonly position: LoomPoint;
  readonly attentionCount: number;
  readonly containsElected: boolean;
};

export type LoomKnotPlacement = {
  readonly id: string;
  readonly item: AttentionItem;
  readonly spindleId: string;
  readonly position: LoomPoint;
  readonly angle: number;
  readonly radius: number;
  readonly contextIds: ReadonlySet<ObjectId>;
  readonly elected: boolean;
  readonly selected: boolean;
  readonly immediateSibling: boolean;
};

export type LoomConnection = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly kind: 'warp' | 'cross-stitch';
  readonly elected: boolean;
  readonly selected: boolean;
};

export type LoomContextEntry = {
  readonly record: ObjectRecord;
  readonly path: readonly string[];
};

export type LoomInspectorContext = Record<'mission' | 'agent' | 'message' | 'evidence', readonly LoomContextEntry[]>;

export type CausalLoomProjection = {
  readonly spindles: readonly LoomSpindle[];
  readonly knots: readonly LoomKnotPlacement[];
  readonly connections: readonly LoomConnection[];
};

const LOOSE_SPINDLE_ID = 'loom:loose-threads';
const GOLDEN_ANGLE = (137.5 * Math.PI) / 180;
const CONTEXT_KINDS = new Set<ObjectKind>(['mission', 'agent', 'message', 'evidence']);

const ROLE_ANGLE: Record<AttentionReason, number> = {
  decision: -145,
  'message-waiting': -70,
  blocked: 10,
  issue: 10,
  'agent-failed': 85,
  'seat-vacant': 85,
  milestone: 155,
  completed: 155,
};

function spindlePosition(index: number): LoomPoint {
  if (index === 0) return { x: 0, y: 0 };
  if (index === 1) return { x: 980, y: -340 };
  if (index === 2) return { x: 760, y: 690 };

  const step = index - 2;
  const radius = 620 * Math.sqrt(step);
  const angle = GOLDEN_ANGLE * step;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function walkToMission(graph: ObjectGraph, starts: readonly ObjectId[]): ObjectRecord | null {
  const seen = new Set<ObjectId>();
  let frontier = [...new Set(starts)].sort();

  for (let depth = 0; depth <= 2 && frontier.length > 0; depth += 1) {
    const missions = frontier
      .map((id) => graph.get(id))
      .filter((record): record is ObjectRecord => record?.kind === 'mission')
      .sort((a, b) => a.id.localeCompare(b.id));
    if (missions[0]) return missions[0];

    const next = new Set<ObjectId>();
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const relation of graph.related(id)) {
        if (!seen.has(relation.record.id)) next.add(relation.record.id);
      }
    }
    frontier = [...next].sort();
  }

  return null;
}

function missionForItem(graph: ObjectGraph, item: AttentionItem): ObjectRecord | null {
  if (item.subject.kind === 'mission') return item.subject;
  return walkToMission(graph, [item.openId, item.subject.id]);
}

function contextIds(graph: ObjectGraph, item: AttentionItem): ReadonlySet<ObjectId> {
  return new Set([
    item.subject.id,
    item.openId,
    ...graph.related(item.subject.id).map(({ record }) => record.id),
    ...graph.related(item.openId).map(({ record }) => record.id),
  ]);
}

function intersects(left: ReadonlySet<ObjectId>, right: ReadonlySet<ObjectId>): boolean {
  for (const id of left) if (right.has(id)) return true;
  return false;
}

function radiusFor(item: AttentionItem, elected: boolean): number {
  if (elected) return 185;
  if (item.reason === 'completed') return 520;
  if (item.reason === 'milestone') return 410;
  return 270;
}

/** Projects authoritative graph/feed truth into temporary loom geometry. */
export function projectCausalLoom(
  graph: ObjectGraph,
  feed: readonly AttentionItem[],
  electedId: string | null,
  selectedId: ObjectId | null,
): CausalLoomProjection {
  const assigned = feed.map((item) => ({ item, mission: missionForItem(graph, item) }));
  const counts = new Map<string, number>();
  for (const { mission } of assigned) {
    const key = mission?.id ?? LOOSE_SPINDLE_ID;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const missionRecords = graph.byKind('mission').slice();
  const needsLoose = assigned.some(({ mission }) => mission === null);
  const spindleSeeds = [
    ...missionRecords.map((mission) => ({ id: `spindle:${mission.id}`, mission })),
    ...(needsLoose ? [{ id: LOOSE_SPINDLE_ID, mission: null }] : []),
  ];

  spindleSeeds.sort((left, right) => {
    const leftKey = left.mission?.id ?? LOOSE_SPINDLE_ID;
    const rightKey = right.mission?.id ?? LOOSE_SPINDLE_ID;
    const leftElected = assigned.some(({ item, mission }) => item.id === electedId && (mission?.id ?? LOOSE_SPINDLE_ID) === leftKey);
    const rightElected = assigned.some(({ item, mission }) => item.id === electedId && (mission?.id ?? LOOSE_SPINDLE_ID) === rightKey);
    if (leftElected !== rightElected) return leftElected ? -1 : 1;
    const countDifference = (counts.get(rightKey) ?? 0) - (counts.get(leftKey) ?? 0);
    return countDifference || leftKey.localeCompare(rightKey);
  });

  const spindles: LoomSpindle[] = spindleSeeds.map((seed, index) => {
    const key = seed.mission?.id ?? LOOSE_SPINDLE_ID;
    return {
      id: seed.id,
      mission: seed.mission,
      title: seed.mission?.title ?? 'Loose threads',
      position: spindlePosition(index),
      attentionCount: counts.get(key) ?? 0,
      containsElected: assigned.some(({ item, mission }) => item.id === electedId && (mission?.id ?? LOOSE_SPINDLE_ID) === key),
    };
  });

  const spindleByKey = new Map(spindles.map((spindle) => [spindle.mission?.id ?? LOOSE_SPINDLE_ID, spindle]));
  const collisionCount = new Map<string, number>();
  const selectedAssignment = assigned.find(({ item }) => item.subject.id === selectedId);
  const selectedSpindleKey = selectedAssignment?.mission?.id ?? (selectedAssignment ? LOOSE_SPINDLE_ID : null);
  let siblingDirection = 1;

  const knots: LoomKnotPlacement[] = assigned.map(({ item, mission }) => {
    const key = mission?.id ?? LOOSE_SPINDLE_ID;
    const spindle = spindleByKey.get(key) ?? spindles[0];
    const elected = item.id === electedId;
    const selected = item.subject.id === selectedId;
    const sectorKey = `${key}:${ROLE_ANGLE[item.reason]}`;
    const collisionIndex = collisionCount.get(sectorKey) ?? 0;
    collisionCount.set(sectorKey, collisionIndex + 1);

    const angleOffset = collisionIndex === 0 ? 0 : Math.ceil(collisionIndex / 2) * 9 * (collisionIndex % 2 ? 1 : -1);
    const angle = ROLE_ANGLE[item.reason] + angleOffset;
    const radians = (angle * Math.PI) / 180;
    let radius = radiusFor(item, elected) + collisionIndex * 72;
    if (selected) radius = Math.max(120, radius - 84);

    const sameSelectedField = selectedSpindleKey === key && selectedId !== null;
    const immediateSibling = sameSelectedField && !selected && Math.abs(ROLE_ANGLE[item.reason] - ROLE_ANGLE[selectedAssignment?.item.reason ?? item.reason]) <= 80;
    const direction = siblingDirection;
    if (immediateSibling) siblingDirection *= -1;
    const tangentialShift = immediateSibling ? 42 * direction : 0;
    const tangentX = -Math.sin(radians) * tangentialShift;
    const tangentY = Math.cos(radians) * tangentialShift;

    return {
      id: `knot:${item.id}`,
      item,
      spindleId: spindle.id,
      position: {
        x: spindle.position.x + Math.cos(radians) * radius + tangentX,
        y: spindle.position.y + Math.sin(radians) * radius + tangentY,
      },
      angle,
      radius,
      contextIds: contextIds(graph, item),
      elected,
      selected,
      immediateSibling,
    };
  });

  const connections: LoomConnection[] = knots.map((knot) => ({
    id: `warp:${knot.spindleId}:${knot.id}`,
    source: knot.spindleId,
    target: knot.id,
    kind: 'warp',
    elected: knot.elected,
    selected: knot.selected,
  }));

  for (let leftIndex = 0; leftIndex < knots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < knots.length; rightIndex += 1) {
      const left = knots[leftIndex];
      const right = knots[rightIndex];
      if (!intersects(left.contextIds, right.contextIds)) continue;
      connections.push({
        id: `cross:${left.id}:${right.id}`,
        source: left.id,
        target: right.id,
        kind: 'cross-stitch',
        elected: false,
        selected: left.selected || right.selected,
      });
    }
  }

  return { spindles, knots, connections };
}

/** A bounded, deduplicated walk-in inspector projection; it never changes location. */
export function buildInspectorContext(graph: ObjectGraph, selected: ObjectRecord): LoomInspectorContext {
  const result: Record<'mission' | 'agent' | 'message' | 'evidence', LoomContextEntry[]> = {
    mission: [],
    agent: [],
    message: [],
    evidence: [],
  };
  const seen = new Set<ObjectId>([selected.id]);
  let frontier: { id: ObjectId; path: string[] }[] = [{ id: selected.id, path: [] }];

  for (let depth = 0; depth < 2; depth += 1) {
    const next: { id: ObjectId; path: string[] }[] = [];
    for (const current of frontier) {
      for (const related of graph.related(current.id)) {
        if (seen.has(related.record.id)) continue;
        seen.add(related.record.id);
        const path = [...current.path, related.relation];
        next.push({ id: related.record.id, path });
        if (CONTEXT_KINDS.has(related.record.kind)) {
          const key = related.record.kind as keyof LoomInspectorContext;
          if (result[key].length < 4) result[key].push({ record: related.record, path });
        }
      }
    }
    frontier = next.sort((left, right) => left.id.localeCompare(right.id));
  }

  return result;
}
