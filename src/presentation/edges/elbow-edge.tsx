import { BaseEdge, EdgeLabelRenderer, Position, type Edge, type EdgeProps } from '@xyflow/react';
import { useMemo, type CSSProperties } from 'react';
import type { ArchitectureEdgeData } from '../projection';
import { wireKindColorVariable, wireKindDashArray, wireStrokeWidth } from '../wire-styles';
import { pointAlong, routePath, routeWire, type RouteSide } from './wire-routing';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

const SIDE_OF_POSITION: Record<Position, RouteSide> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** Restrained selectable elbow wire; kind decides dash and colour, the router decides the path. */
export function ElbowEdge(props: EdgeProps<ElbowFlowEdge>) {
  const lane = props.data?.lane ?? 0;
  const route = useMemo(() => routeWire({
    source: { x: props.sourceX, y: props.sourceY },
    sourceSide: SIDE_OF_POSITION[props.sourcePosition],
    target: { x: props.targetX, y: props.targetY },
    targetSide: SIDE_OF_POSITION[props.targetPosition],
    lane,
  }), [lane, props.sourcePosition, props.sourceX, props.sourceY,
    props.targetPosition, props.targetX, props.targetY]);
  const path = useMemo(() => routePath(route.points, 6), [route]);
  const label = useMemo(() => pointAlong(route.points, 0.5), [route]);

  const visibility = props.data?.preferences.wires.showLabels;
  const showLabel = !props.data?.editable || visibility === 'always'
    || (visibility === 'selected' && props.selected);
  const kind = props.data?.kind ?? 'references';
  // Colour flows through a custom property so the selected-state CSS still wins.
  const style: CSSProperties = {
    strokeWidth: wireStrokeWidth(props.data?.preferences.wires.width),
    strokeDasharray: wireKindDashArray(kind) || undefined,
    '--wire-stroke': wireKindColorVariable(kind),
  } as CSSProperties;
  return (
    <>
      <BaseEdge
        id={props.id}
        interactionWidth={18}
        markerEnd={props.markerEnd}
        path={path}
        style={style}
      />
      {showLabel && props.data?.label && (
        <EdgeLabelRenderer>
          <button
            className={`wire-label nodrag nopan${props.selected ? ' is-selected' : ''}`}
            onClick={(event) => { event.stopPropagation(); props.data?.select(); }}
            style={{
              transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
              zIndex: props.selected ? 1001 : undefined,
            }}
            type="button"
          >{props.data.label}</button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
