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
  nearestPositionAlong, pointAlong, routeWire, type RouteSide,
} from './wire-routing';
import { asWireShape, wirePath } from './wire-shape';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

const SIDE_OF_POSITION: Record<Position, RouteSide> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** Where the label sits when nobody has moved it: the middle of the wire. */
const DEFAULT_LABEL_POSITION = 0.5;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

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
  /*
   * Shape is a look, not a route.
   *
   * Every shape draws the SAME points the router chose, so choosing curves cannot make a wire
   * start cutting through a node — obstacle avoidance happens before this line and is not
   * something a preference can switch off.
   */
  const shape = asWireShape(props.data?.preferences.wires.shape);
  const path = useMemo(() => wirePath(route.points, shape), [route, shape]);

  // While the label is being dragged its place is local: the record hears one intention when the
  // drag ends, not sixty as the pointer moves.
  const [dragged, setDragged] = useState<number | null>(null);
  const moved = useRef(false);
  // Measured once the label is on screen, in flow units, so the search below works in the same
  // space the route does.
  const [labelSize, setLabelSize] = useState({ width: 0, height: 0 });
  const measureLabel = useCallback((element: HTMLButtonElement | null) => {
    if (!element) return;
    const box = element.getBoundingClientRect();
    const zoom = Number(getComputedStyle(element).getPropertyValue('--nvk-label-zoom')) || 1;
    const next = { width: box.width / zoom, height: box.height / zoom };
    setLabelSize((current) => (Math.abs(current.width - next.width) < 1
      && Math.abs(current.height - next.height) < 1 ? current : next));
  }, []);

  const stored = props.data?.route.labelPosition;
  /*
   * The default label position steps aside for whatever it would land on.
   *
   * The midpoint of a route is often inside a node — a wire passing a box has its middle right
   * over it — which put fifteen labels across seven of Chris's diagrams on top of node text.
   * Positions are tried outward from the middle so the label still reads as belonging to the
   * middle of the wire, and the first clear one wins. A position someone dragged is never
   * second-guessed: it is already an answer to this question.
   */
  const clearPosition = useMemo(() => {
    const rects = obstacles ?? [];
    if (rects.length === 0) return DEFAULT_LABEL_POSITION;
    // The label is a box, not a point: testing its anchor alone left it overlapping by most of
    // its own width. Its measured half-extents are what has to clear the node.
    const halfWidth = labelSize.width / 2;
    const halfHeight = labelSize.height / 2;
    const covered = (at: number): boolean => {
      const point = pointAlong(route.points, at);
      return rects.some(({ rect }) => point.x + halfWidth > rect.x
        && point.x - halfWidth < rect.x + rect.width
        && point.y + halfHeight > rect.y
        && point.y - halfHeight < rect.y + rect.height);
    };
    if (!covered(DEFAULT_LABEL_POSITION)) return DEFAULT_LABEL_POSITION;
    for (let step = 1; step <= 8; step += 1) {
      for (const at of [DEFAULT_LABEL_POSITION - step * 0.05, DEFAULT_LABEL_POSITION + step * 0.05]) {
        if (at > 0.06 && at < 0.94 && !covered(at)) return at;
      }
    }
    return DEFAULT_LABEL_POSITION;
  }, [labelSize.height, labelSize.width, obstacles, route]);
  const labelPosition = dragged ?? stored ?? clearPosition;
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
  /*
   * The corridor handle steps aside from the label.
   *
   * Both defaulted to the middle of the wire, so the handle sat inside the label's own text —
   * "gr(o)ts" — and the two competed for the same pointer. The label owns the middle, because
   * it is the thing being read; the handle takes a fifth of the way further along, which is
   * still plainly on this wire and no longer on top of its name.
   */
  const handleAt = clamp(labelPosition + 0.2, 0.12, 0.88);
  const shapeHandle = shaping ?? props.data?.route.waypoints[0] ?? pointAlong(route.points, handleAt);
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
      {/*
        Two circles per end: the mark you see, and the region you grab.

        The radii are set in CSS so they can divide by the live zoom and stay a constant size to
        the hand. The grab circle is invisible and much wider than the dot — releasing a few
        pixels off the mark used to miss it entirely and the wire read as snapping back.
      */}
      {ends.map((end, index) => {
        const which = index === 0 ? 'source' : 'target';
        if (!end) return null;
        const x = dragEnd?.end === which ? dragEnd.x : end.x;
        const y = dragEnd?.end === which ? dragEnd.y : end.y;
        return (
          <g key={which}>
            <circle className="wire-endpoint" cx={x} cy={y} />
            {moveEnd && (
              <circle
                className="wire-grab"
                cx={x}
                cy={y}
                onPointerDown={onEndPointerDown(which)}
                onPointerMove={onEndPointerMove}
                onPointerUp={onEndPointerUp}
              />
            )}
          </g>
        );
      })}
      {props.selected && setRoute && (
        <g>
          <circle className="wire-waypoint" cx={shapeHandle.x} cy={shapeHandle.y} />
          <circle
            className="wire-grab"
            cx={shapeHandle.x}
            cy={shapeHandle.y}
            onDoubleClick={(event) => { event.stopPropagation(); setRoute({ waypoints: [] }); }}
            onPointerDown={onShapePointerDown}
            onPointerMove={onShapePointerMove}
            onPointerUp={onShapePointerUp}
          />
        </g>
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
            ref={measureLabel}
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
