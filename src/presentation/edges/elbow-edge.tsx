import { BaseEdge, Position, type Edge, type EdgeProps } from '@xyflow/react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { ArchitectureEdgeData } from '../projection';
import {
  routeWire, type RouteSide, type WireRouteEditResult,
} from '@novakai/canvas';
import { wirePath } from '@novakai/canvas';
import { useWireLabel } from './wire-label';
import { WireRouteHandles } from './wire-route-handles';
import { planWireEndDecorations } from '@novakai/canvas';

type ElbowFlowEdge = Edge<ArchitectureEdgeData, 'elbow'>;

const SIDE_OF_POSITION: Record<Position, RouteSide> = {
  [Position.Top]: 'top', [Position.Right]: 'right',
  [Position.Bottom]: 'bottom', [Position.Left]: 'left',
};

/** Selectable wire composed from framework-free planning/drawing and focused interaction adapters. */
export function ElbowEdge(props: EdgeProps<ElbowFlowEdge>) {
  const planned = props.data?.route.points;
  const routeRequest = useMemo(() => ({
    source: { x: props.sourceX, y: props.sourceY },
    sourceSide: SIDE_OF_POSITION[props.sourcePosition],
    target: { x: props.targetX, y: props.targetY },
    targetSide: SIDE_OF_POSITION[props.targetPosition],
    obstacles: props.data?.obstacles,
    lane: props.data?.lane ?? 0,
  }), [props.data?.lane, props.data?.obstacles, props.sourcePosition, props.sourceX, props.sourceY,
    props.targetPosition, props.targetX, props.targetY]);
  const committed = useMemo(() => {
    const first = planned?.[0];
    const last = planned?.at(-1);
    if (planned && first?.x === props.sourceX && first.y === props.sourceY
      && last?.x === props.targetX && last.y === props.targetY) {
      return { points: planned, collisions: 0, softCollisions: 0 };
    }
    return routeWire({
      ...routeRequest,
      waypoints: props.data?.route.waypoints,
    });
  }, [planned, props.data?.route.waypoints, props.sourceX, props.sourceY, props.targetX,
    props.targetY, routeRequest]);
  const [preview, setPreview] = useState<WireRouteEditResult | null>(null);
  const [hovered, setHovered] = useState(false);
  const route = preview?.route ?? committed;
  const shape = props.data?.appearance.shape ?? 'elbow';
  const decorations = useMemo(() => planWireEndDecorations(
    route.points, props.data?.sourceCardinality, props.data?.targetCardinality,
  ), [route.points, props.data?.sourceCardinality, props.data?.targetCardinality]);
  const path = useMemo(
    () => wirePath(decorations.bodyPoints, shape), [decorations.bodyPoints, shape],
  );

  const setRoute = props.data?.setRoute;
  const label = useWireLabel({
    seed: props.id,
    label: props.data?.label ?? '',
    kind: props.data?.labelKind ?? 'wire',
    points: route.points,
    obstacles: props.data?.obstacles,
    storedPosition: props.data?.route.labelPosition,
    selected: Boolean(props.selected),
    related: Boolean(props.data?.related),
    hovered,
    emphasis: props.data?.flowActive ? props.data.emphasis : undefined,
    movable: Boolean(setRoute),
    select: () => props.data?.select(),
    setPosition: setRoute ? (labelPosition) => setRoute({ labelPosition }) : undefined,
  });
  const appearance = props.data?.appearance;
  const style: CSSProperties = {
    strokeWidth: appearance?.strokeWidth,
    strokeDasharray: appearance?.dashArray || undefined,
    '--wire-stroke': appearance?.strokeColorCss,
  } as CSSProperties;

  return <>
    <g data-emphasis={props.data?.emphasis}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <BaseEdge className={preview && !preview.valid ? 'wire-preview-invalid' : undefined}
        id={props.id} interactionWidth={18} markerEnd={props.markerEnd} path={path} style={style} />
      {decorations.notationMode && <g fill="none" stroke={appearance?.strokeColorCss}
        strokeLinecap="round" strokeLinejoin="round" strokeWidth={appearance?.strokeWidth}>
        {decorations.lines.map((line, index) => <line key={`line-${index}`}
          x1={line.from.x} x2={line.to.x} y1={line.from.y} y2={line.to.y} />)}
        {decorations.circles.map((circle, index) => <circle key={`circle-${index}`}
          cx={circle.center.x} cy={circle.center.y} fill="none" r={circle.radius} />)}
      </g>}
    </g>
    <WireRouteHandles
      editable={Boolean(props.data?.editable)}
      preview={setPreview}
      route={route}
      routeRequest={routeRequest}
      selected={Boolean(props.selected)}
      snap={{
        enabled: props.data?.preferences.canvas.snapToGrid ?? false,
        gridSize: props.data?.preferences.canvas.gridSize ?? 8,
      }}
      setWaypoints={setRoute && shape !== 'straight'
        ? (waypoints) => setRoute({ waypoints }) : undefined}
    />
    {label.element}
  </>;
}
