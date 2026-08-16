/**
 * Where everything stands on the field.
 *
 * Position is the sentence: roots hang from one spine on the left, consequences
 * trail right by causal depth, the heaviest chain lies at the top, and settled work
 * lies below the horizon. A small deterministic drift keeps the field from reading
 * as a grid without ever moving between renders.
 */
import type { ObjectId, ObjectRecord } from '../../../../object-graph/contract';
import type { CausalChain } from './chains';

export type FieldVariant = 'monolith' | 'root' | 'consequence' | 'sediment';

export type FieldPlacement = {
  readonly id: ObjectId;
  readonly record: ObjectRecord;
  readonly variant: FieldVariant;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
};

export type FieldWire = {
  readonly id: string;
  readonly source: ObjectId;
  readonly target: ObjectId;
  readonly verb: string;
  readonly chainIndex: number;
};

export type FieldBand = {
  readonly chainIndex: number;
  readonly top: number;
  readonly height: number;
  readonly reach: number;
};

export type FieldLayout = {
  readonly placements: readonly FieldPlacement[];
  readonly wires: readonly FieldWire[];
  readonly bands: readonly FieldBand[];
  readonly spineX: number;
  readonly horizonY: number;
  readonly bounds: { x: number; y: number; width: number; height: number };
  /** Object id → indexes of every chain that touches it. Convergence made queryable. */
  readonly chainsOf: ReadonlyMap<ObjectId, readonly number[]>;
};

const SPINE_X = 0;
const COLUMN_W = 340;
const ROW_H = 88;
const BAND_PAD = 40;
const BAND_GAP = 28;
const SEDIMENT_GAP = 84;
const SEDIMENT_SPACING = 280;

/** Stable per-object drift, ±18px, so the field breathes without a random source. */
function drift(id: string, salt: number): number {
  let hash = salt;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return ((hash % 37) / 37) * 36 - 18;
}

export function layoutField(chains: readonly CausalChain[]): FieldLayout {
  const placements: FieldPlacement[] = [];
  const wires: FieldWire[] = [];
  const bands: FieldBand[] = [];
  const placed = new Map<ObjectId, FieldPlacement>();
  const chainsOf = new Map<ObjectId, number[]>();

  const live = chains.filter((chain) => !chain.settled);
  const settled = chains.filter((chain) => chain.settled);

  const touch = (id: ObjectId, chainIndex: number) => {
    const list = chainsOf.get(id) ?? [];
    if (!list.includes(chainIndex)) list.push(chainIndex);
    chainsOf.set(id, list);
  };

  let cursorY = 0;

  live.forEach((chain, liveIndex) => {
    const chainIndex = chains.indexOf(chain);
    const isMonolith = liveIndex === 0;

    const rowsAtDepth = new Map<number, number>();
    for (const link of chain.links) {
      rowsAtDepth.set(link.depth, (rowsAtDepth.get(link.depth) ?? 0) + 1);
    }
    const deepestRows = Math.max(1, ...rowsAtDepth.values());
    const reach = Math.max(0, ...chain.links.map((link) => link.depth));
    const height = deepestRows * ROW_H + BAND_PAD * (isMonolith ? 2.2 : 1.5);
    const bandTop = cursorY;
    const centerY = bandTop + height / 2;
    bands.push({ chainIndex, top: bandTop, height, reach });

    touch(chain.root.id, chainIndex);
    if (!placed.has(chain.root.id)) {
      const placement: FieldPlacement = {
        id: chain.root.id,
        record: chain.root,
        variant: isMonolith ? 'monolith' : 'root',
        depth: 0,
        x: SPINE_X,
        y: centerY,
      };
      placed.set(chain.root.id, placement);
      placements.push(placement);
    }

    const filledRows = new Map<number, number>();
    for (const link of chain.links) {
      touch(link.record.id, chainIndex);
      wires.push({
        id: `wire:${chainIndex}:${link.from}:${link.record.id}`,
        source: link.from,
        target: link.record.id,
        verb: link.verb,
        chainIndex,
      });
      if (placed.has(link.record.id)) continue;

      const row = filledRows.get(link.depth) ?? 0;
      filledRows.set(link.depth, row + 1);
      const rows = rowsAtDepth.get(link.depth) ?? 1;
      const placement: FieldPlacement = {
        id: link.record.id,
        record: link.record,
        variant: 'consequence',
        depth: link.depth,
        x: SPINE_X + link.depth * COLUMN_W + drift(link.record.id, 7),
        y: bandTop + BAND_PAD + (row + 0.5) * (height - BAND_PAD * 2) / rows + drift(link.record.id, 13) * 0.4,
      };
      placed.set(link.record.id, placement);
      placements.push(placement);
    }

    cursorY = bandTop + height + BAND_GAP;
  });

  const horizonY = cursorY + SEDIMENT_GAP / 2;

  settled.forEach((chain, settledIndex) => {
    const chainIndex = chains.indexOf(chain);
    touch(chain.root.id, chainIndex);
    if (placed.has(chain.root.id)) return;
    const placement: FieldPlacement = {
      id: chain.root.id,
      record: chain.root,
      variant: 'sediment',
      depth: 0,
      x: SPINE_X + 140 + settledIndex * SEDIMENT_SPACING + drift(chain.root.id, 3),
      y: horizonY + SEDIMENT_GAP + drift(chain.root.id, 5) * 0.5,
    };
    placed.set(chain.root.id, placement);
    placements.push(placement);
  });

  const maxReach = Math.max(1, ...bands.map((band) => band.reach));
  const bounds = {
    x: SPINE_X - 380,
    y: -120,
    width: maxReach * COLUMN_W + 760,
    height: horizonY + SEDIMENT_GAP * 2 + 240,
  };

  return { placements, wires, bands, spineX: SPINE_X, horizonY, bounds, chainsOf };
}
