import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { ArchitectureEdgeData } from '../projection';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

/** Restrained selectable elbow wire renderer. */
export function ElbowEdge(props: EdgeProps<ElbowFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition,
    borderRadius: 6,
  });
  const visibility = props.data?.preferences.wires.showLabels;
  const showLabel = visibility === 'always' || (visibility === 'selected' && props.selected);
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={{ strokeWidth: props.data?.preferences.wires.width }} />
      {showLabel && props.data?.label && (
        <EdgeLabelRenderer>
          <button
            className="wire-label nodrag nopan"
            onClick={(event) => { event.stopPropagation(); props.data?.select(); }}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            type="button"
          >{props.data.label}</button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
