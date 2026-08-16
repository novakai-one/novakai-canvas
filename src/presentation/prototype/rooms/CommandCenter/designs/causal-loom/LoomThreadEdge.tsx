import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';

export type LoomThreadData = {
  readonly kind: 'warp' | 'cross-stitch';
  readonly selected: boolean;
  readonly elected: boolean;
  readonly dimmed: boolean;
  readonly releasing?: boolean;
};

export type LoomThreadFlowEdge = Edge<LoomThreadData, 'loom-thread'>;

/** Multi-stroke fibers sag at rest and pull taut through the selected cause. */
export function LoomThreadEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<LoomThreadFlowEdge>) {
  const selected = data?.selected ?? false;
  const delta = Math.max(36, Math.abs(targetX - sourceX) * (selected ? 0.24 : 0.42));
  const sag = selected ? 0 : Math.min(110, Math.abs(targetY - sourceY) * 0.12 + 32);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + delta} ${sourceY + sag}, ${targetX - delta} ${targetY + sag}, ${targetX} ${targetY}`;

  return (
    <g
      className="loom-thread"
      data-kind={data?.kind ?? 'warp'}
      data-selected={selected}
      data-elected={data?.elected ?? false}
      data-dimmed={data?.dimmed ?? false}
      data-releasing={data?.releasing ?? false}
    >
      <BaseEdge id={`${id}:bed`} path={path} className="loom-thread__bed" />
      <BaseEdge id={id} path={path} className="loom-thread__fiber" />
      <BaseEdge id={`${id}:filament`} path={path} className="loom-thread__filament" />
    </g>
  );
}
