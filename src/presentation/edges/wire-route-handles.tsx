import { useReactFlow } from '@xyflow/react';
import {
  useCallback, useState, type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  editableRouteSegments, pointAlong, reshapeRouteSegment, type Point, type WireRoute,
  type WireRouteEditResult, type WireRouteRequest,
} from '../../domain/diagram-geometry';

interface RouteHandleProps {
  route: WireRoute;
  routeRequest: WireRouteRequest;
  selected: boolean;
  editable: boolean;
  snap: { enabled: boolean; gridSize: number };
  setWaypoints?: (waypoints: Point[]) => void;
  preview: (result: WireRouteEditResult | null) => void;
  moveEnd?: (end: 'source' | 'target', nodeId: string, side?: string) => void;
}

interface SegmentDrag {
  segmentIndex?: number;
  route: WireRoute;
}

/** Adapts pointer gestures to framework-free route edits and endpoint commands. */
export function WireRouteHandles(props: RouteHandleProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { moveEnd } = props;
  const [segmentDrag, setSegmentDrag] = useState<SegmentDrag | null>(null);
  const [candidate, setCandidate] = useState<WireRouteEditResult | null>(null);
  const [dragEnd, setDragEnd] = useState<{
    end: 'source' | 'target'; x: number; y: number;
  } | null>(null);

  const startSegment = useCallback((segmentIndex?: number) =>
    (event: ReactPointerEvent<SVGCircleElement>) => {
      if (!props.setWaypoints || event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setSegmentDrag({ segmentIndex, route: props.route });
    }, [props.route, props.setWaypoints]);
  const moveSegment = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!segmentDrag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.stopPropagation();
    const next = reshapeRouteSegment({
      route: segmentDrag.route,
      routeRequest: props.routeRequest,
      segmentIndex: segmentDrag.segmentIndex,
      pointer: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      snap: props.snap,
    });
    setCandidate(next);
    props.preview(next);
  }, [props, screenToFlowPosition, segmentDrag]);
  const endSegment = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    if (!segmentDrag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (candidate?.valid) props.setWaypoints?.(candidate.waypoints);
    setSegmentDrag(null);
    setCandidate(null);
    props.preview(null);
  }, [candidate, props, segmentDrag]);

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
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const port = under?.closest<HTMLElement>('.react-flow__handle');
    const nodeId = port?.closest<HTMLElement>('.react-flow__node')?.dataset.id;
    if (port && nodeId) moveEnd(end, nodeId, port.dataset.handleid);
  }, [dragEnd, moveEnd]);

  if (!props.selected || !props.editable) return null;
  const ends = [props.route.points[0], props.route.points.at(-1)];
  const segments = editableRouteSegments(props.route.points);
  const handles = segments.length > 0 ? segments : [{
    index: undefined,
    axis: undefined,
    midpoint: pointAlong(props.route.points, 0.5),
  }];
  return <>
    {ends.map((point, index) => {
      if (!point) return null;
      const end = index === 0 ? 'source' : 'target';
      const position = dragEnd?.end === end ? dragEnd : point;
      return <g key={end}>
        <circle className="wire-endpoint" cx={position.x} cy={position.y} />
        {moveEnd && <circle className="wire-grab" cx={position.x} cy={position.y}
          onPointerDown={onEndPointerDown(end)} onPointerMove={onEndPointerMove}
          onPointerUp={onEndPointerUp} />}
      </g>;
    })}
    {props.setWaypoints && handles.map((handle) => <g key={handle.index ?? 'new'}>
      <circle className={`wire-segment-handle${candidate && !candidate.valid ? ' is-invalid' : ''}`}
        cx={handle.midpoint.x} cy={handle.midpoint.y} />
      <circle className={`wire-grab wire-grab--${handle.axis ?? 'free'}`}
        cx={handle.midpoint.x} cy={handle.midpoint.y}
        onDoubleClick={(event) => { event.stopPropagation(); props.setWaypoints?.([]); }}
        onPointerDown={startSegment(handle.index)} onPointerMove={moveSegment}
        onPointerUp={endSegment} />
    </g>)}
  </>;
}
