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
}

interface SegmentDrag {
  segmentIndex?: number;
  route: WireRoute;
}

/** Adapts selected-wire corridor gestures to framework-free route edits. */
export function WireRouteHandles(props: RouteHandleProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [segmentDrag, setSegmentDrag] = useState<SegmentDrag | null>(null);
  const [candidate, setCandidate] = useState<WireRouteEditResult | null>(null);

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
      return <circle key={index === 0 ? 'source' : 'target'} className="wire-endpoint" cx={point.x} cy={point.y} />;
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
