/**
 * Adapts field geometry into React Flow without owning any domain truth.
 *
 * Everything stateful — which chain is focal, which is settling, which node the
 * drawer lit — arrives as arguments and leaves as node/edge data for CSS to render.
 */
import type { Edge, Node } from '@xyflow/react';
import type { AttentionItem } from '../../../../attention/feed';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { CausalChain } from './chains';
import type { FieldLayout, FieldVariant } from './field-layout';
import type { FieldTier } from './field-semantic-zoom';

export interface ChainChipData extends Record<string, unknown> {
  record: ObjectRecord;
  variant: FieldVariant;
  depth: number;
  tier: FieldTier;
  dimmed: boolean;
  lit: boolean;
  settling: boolean;
  /** Present only on roots: the feed item this object anchors. */
  item: AttentionItem | null;
  onAct: ((kind: string) => void) | null;
}

export type ChainChipNode = Node<ChainChipData, 'chain-chip'>;

export interface CausalWireData extends Record<string, unknown> {
  verb: string;
  state: 'idle' | 'focal' | 'settling' | 'settled';
  dimmed: boolean;
  tier: FieldTier;
}

export type CausalWireEdge = Edge<CausalWireData, 'causal'>;

export interface FieldProjection {
  chains: readonly CausalChain[];
  tier: FieldTier;
  focalChains: ReadonlySet<number>;
  settlingChain: number | null;
  litId: string | null;
  selectedId: string | null;
  onAct: (item: AttentionItem, kind: string) => void;
}

const Z_INDEX: Record<FieldVariant, number> = {
  monolith: 30,
  root: 14,
  consequence: 8,
  sediment: 2,
};

export function fieldToFlow(layout: FieldLayout, projection: FieldProjection) {
  const { chains, tier, focalChains, settlingChain, litId, selectedId, onAct } = projection;
  const rootItem = new Map(chains.map((chain) => [chain.root.id, chain.item]));
  const hasFocus = focalChains.size > 0;

  const inFocalChain = (id: string): boolean =>
    (layout.chainsOf.get(id) ?? []).some((index) => focalChains.has(index));
  const inSettlingChain = (id: string): boolean =>
    settlingChain !== null && (layout.chainsOf.get(id) ?? []).includes(settlingChain);

  const nodes: ChainChipNode[] = layout.placements.map((placement) => {
    const item = rootItem.get(placement.id) ?? null;
    return {
      id: placement.id,
      type: 'chain-chip',
      position: { x: placement.x, y: placement.y },
      origin: [0.5, 0.5],
      selected: placement.id === selectedId,
      draggable: true,
      selectable: true,
      deletable: false,
      zIndex: placement.id === selectedId ? 40 : Z_INDEX[placement.variant],
      ariaLabel: `${placement.record.kind}: ${placement.record.title}`,
      data: {
        record: placement.record,
        variant: placement.variant,
        depth: placement.depth,
        tier,
        dimmed: hasFocus && !inFocalChain(placement.id) && !inSettlingChain(placement.id),
        lit: placement.id === litId,
        settling: inSettlingChain(placement.id),
        item: placement.variant === 'monolith' || placement.variant === 'root' ? item : null,
        onAct: item && onAct ? (kind: string) => onAct(item, kind) : null,
      },
    };
  });

  const edges: CausalWireEdge[] = layout.wires.map((wire) => {
    const settling = settlingChain === wire.chainIndex;
    const settled = chains[wire.chainIndex]?.settled ?? false;
    return {
      id: wire.id,
      source: wire.source,
      target: wire.target,
      type: 'causal',
      selectable: false,
      focusable: false,
      deletable: false,
      data: {
        verb: wire.verb,
        state: settling ? 'settling' : settled ? 'settled' : focalChains.has(wire.chainIndex) ? 'focal' : 'idle',
        dimmed: hasFocus && !focalChains.has(wire.chainIndex) && !settling,
        tier,
      },
    };
  });

  return { nodes, edges };
}
