import {
  BaseEdge, EdgeLabelRenderer, Position, useReactFlow, type Edge, type EdgeProps,
} from '@xyflow/react';
import {
  useCallback, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ArchitectureEdgeData } from '../projection';
import { wireKindColorVariable, wireKindDashArray, wireStrokeWidth } from '../wire-styles';
import {
  nearestPositionAlong, pointAlong, routePath, routeWire, type RouteSide,
} from './wire-routing';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

const SIDE_OF_POSITION: Record<Position, RouteSide> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** Where the label sits when nobody has moved it: the middle of the wire. */
const DEFAULT_LABEL_POSITION = 0.5;

/** Restrained selectable elbow wire; kind decides dash and colour, the router decides the path. */
export function ElbowEdge(props: EdgeProps<ElbowFlowEdge>) {
  const { screenToFlowPosition } = useReactFlow();
  const lane = props.data?.lane ?? 0;
  const waypoints = props.data?.route.waypoints;
  /*
   * The obstacles reach the router.
   *
   * `projectEdges` has always computed what each wire must route around and handed it over in
   * edge data — and this call dropped it, so the drawn route was the one the router picks when
   * it believes the canvas is empty. The routing gate calls `routeWire` *with* obstacles, which
   * is why it stayed green while wires visibly cut through nodes on screen: it was proving a
   * code path the application never executed.
   */
  const obstacles = props.data?.obstacles;
  const route = useMemo(() => routeWire({
    source: { x: props.sourceX, y: props.sourceY },
    sourceSide: SIDE_OF_POSITION[props.sourcePosition],
    target: { x: props.targetX, y: props.targetY },
    targetSide: SIDE_OF_POSITION[props.targetPosition],
    obstacles,
    waypoints,
    lane,
  }), [lane, obstacles, props.sourcePosition, props.sourceX, props.sourceY,
    props.targetPosition, props.targetX, props.targetY, waypoints]);
  const path = useMemo(() => routePath(route.points, 6), [route]);

  // While the label is being dragged its place is local: the record hears one intention when the
  // drag ends, not sixty as the pointer moves.
  const [dragged, setDragged] = useState<number | null>(null);
  const moved = useRef(false);
  const stored = props.data?.route.labelPosition;
  const labelPosition = dragged ?? stored ?? DEFAULT_LABEL_POSITION;
  const label = useMemo(() => pointAlong(route.points, labelPosition), [labelPosition, route]);

  const setRoute = props.data?.setRoute;
  const onLabelPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setRoute || event.button !== 0) return;
    event.stopPropagation();
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [setRoute]);
  const onLabelPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setRoute || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moved.current = true;
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setDragged(nearestPositionAlong(route.points, point));
  }, [route.points, screenToFlowPosition, setRoute]);
  const onLabelPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setRoute || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragged !== null && moved.current) setRoute({ labelPosition: dragged });
    setDragged(null);
  }, [dragged, setRoute]);

  // Shaping the corridor: one handle, dragged where the wire should pass, cleared by a
  // double-click. The record hears one intention when the drag ends.
  const [shaping, setShaping] = useState<{ x: number; y: number } | null>(null);
  const shapeHandle = shaping ?? props.data?.route.waypoints[0] ?? pointAlong(route.points, 0.5);
  const onShapePointerDown = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!setRoute || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setShaping(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [screenToFlowPosition, setRoute]);
  const onShapePointerMove = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!setRoute || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.stopPropagation();
    setShaping(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }, [screenToFlowPosition, setRoute]);
  const onShapePointerUp = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!setRoute || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (shaping) setRoute({ waypoints: [shaping] });
    setShaping(null);
  }, [setRoute, shaping]);

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
  /*
   * Moving an end is this wire's job, not React Flow's.
   *
   * React Flow reconnects by listening for a mousedown within a radius of the edge's end — an
   * invisible target that a node's own port now sits directly on top of and swallows. So the
   * end you can see is the end you drag: pointer capture here, and on release the port under
   * the cursor decides both the node and the side. That side is then stored, which is the half
   * that never existed — `preferredSourceSide`/`preferredTargetSide` have been in the schema
   * with no writer, so every previous attempt was redrawn on the default side and read as
   * snapping back.
   */
  const moveEnd = props.data?.moveEnd;
  const [dragEnd, setDragEnd] = useState<{ end: 'source' | 'target'; x: number; y: number } | null>(null);
  const onEndPointerDown = useCallback((end: 'source' | 'target') =>
    (event: ReactPointerEvent<SVGCircleElement>) => {
      if (!moveEnd || event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragEnd({ end, ...screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
    }, [moveEnd, screenToFlowPosition]);
  const onEndPointerMove = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!moveEnd || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.stopPropagation();
    setDragEnd((current) => current && {
      ...current, ...screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    });
  }, [moveEnd, screenToFlowPosition]);
  const onEndPointerUp = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!moveEnd || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const end = dragEnd?.end;
    setDragEnd(null);
    if (!end) return;
    // The port under the release point names both the node and the side in one lookup.
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const port = under?.closest<HTMLElement>('.react-flow__handle');
    const nodeId = port?.closest<HTMLElement>('.react-flow__node')?.dataset.id;
    if (!port || !nodeId) return;
    moveEnd(end, nodeId, port.dataset.handleid);
  }, [dragEnd, moveEnd]);

  const ends = props.selected && props.data?.editable
    ? [route.points[0], route.points.at(-1)] : [];
  return (
    <>
      <BaseEdge
        id={props.id}
        interactionWidth={18}
        markerEnd={props.markerEnd}
        path={path}
        style={style}
      />
      {/*
        The reconnect targets React Flow already listens on are invisible. A selected wire shows
        where its ends are, so "drag this somewhere else" is an offer rather than a secret.
      */}
      {ends.map((end, index) => end && (
        <circle
          className={`wire-endpoint${moveEnd ? ' is-grabbable' : ''}`}
          cx={dragEnd?.end === (index === 0 ? 'source' : 'target') ? dragEnd.x : end.x}
          cy={dragEnd?.end === (index === 0 ? 'source' : 'target') ? dragEnd.y : end.y}
          key={index === 0 ? 'source' : 'target'}
          onPointerDown={onEndPointerDown(index === 0 ? 'source' : 'target')}
          onPointerMove={onEndPointerMove}
          onPointerUp={onEndPointerUp}
          r={7}
        />
      ))}
      {props.selected && setRoute && (
        <circle
          className="wire-waypoint"
          cx={shapeHandle.x}
          cy={shapeHandle.y}
          onDoubleClick={(event) => { event.stopPropagation(); setRoute({ waypoints: [] }); }}
          onPointerDown={onShapePointerDown}
          onPointerMove={onShapePointerMove}
          onPointerUp={onShapePointerUp}
          r={5}
        />
      )}
      {showLabel && props.data?.label && (
        <EdgeLabelRenderer>
          <button
            className={`wire-label nodrag nopan${props.selected ? ' is-selected' : ''}${setRoute ? ' is-movable' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              if (!moved.current) props.data?.select();
            }}
            onPointerDown={onLabelPointerDown}
            onPointerMove={onLabelPointerMove}
            onPointerUp={onLabelPointerUp}
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
