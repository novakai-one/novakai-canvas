import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ArchitectureEdgeData } from '../projection';
import { wireKindColorVariable, wireKindDashArray } from '../wire-styles';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

/** Restrained selectable elbow wire renderer; kind decides dash and colour. */
export function ElbowEdge(props: EdgeProps<ElbowFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
    borderRadius: 6,
  });
  const visibility = props.data?.preferences.wires.showLabels;
  const showLabel = !props.data?.editable || visibility === 'always'
    || (visibility === 'selected' && props.selected);
  const kind = props.data?.kind ?? 'references';
  // Colour flows through a custom property so the selected-state CSS still wins.
  const style: CSSProperties = {
    strokeWidth: props.data?.preferences.wires.width,
    strokeDasharray: wireKindDashArray(kind) || undefined,
    '--wire-stroke': wireKindColorVariable(kind),
  } as CSSProperties;
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={style} />
      {showLabel && props.data?.label && (
        <EdgeLabelRenderer>
          <button
            className={`wire-label nodrag nopan${props.selected ? ' is-selected' : ''}`}
            onClick={(event) => { event.stopPropagation(); props.data?.select(); }}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              zIndex: props.selected ? 1001 : undefined,
            }}
            type="button"
          >{props.data.label}</button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
