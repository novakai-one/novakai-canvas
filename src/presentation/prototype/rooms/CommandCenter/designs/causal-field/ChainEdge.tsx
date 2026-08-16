/**
 * A causal wire: cause on the left, consequence on the right, verb at the midpoint.
 *
 * The geometry is the sentence — the label only names the relation, in the same tiny
 * mono vocabulary the fixtures themselves use. Settling wires redraw themselves in
 * sage from cause to consequence; CSS owns every colour.
 */
import { EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from '@xyflow/react';
import type { CausalWireEdge } from './field-to-flow';

export function ChainEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<CausalWireEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.32,
  });
  const state = data?.state ?? 'idle';
  const marker = `causal-arrow-${id}`;

  return (
    <g className="causal-wire" data-state={state} data-dimmed={data?.dimmed} data-tier={data?.tier}>
      <defs>
        <marker
          id={marker}
          className="causal-wire__marker"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto-start-reverse"
        >
          <path d="M0.5,0.5 L6.5,3.5 L0.5,6.5 Z" />
        </marker>
      </defs>
      <path className="causal-wire__line" d={path} markerEnd={`url(#${marker})`} />
      {data?.verb && (
        <EdgeLabelRenderer>
          <span
            className="causal-wire__verb"
            data-state={state}
            data-dimmed={data?.dimmed}
            data-tier={data?.tier}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.verb}
          </span>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
