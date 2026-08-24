import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import {
  useCallback, useMemo, useRef, useState, type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  nearestPositionAlong, pointAlong, type Point, type RouteObstacle,
} from '../../domain/diagram-geometry';
import { wireLabelSpread } from '../../domain/wire-label-seed';

const DEFAULT_LABEL_POSITION = 0.5;
/** Gap between the wire's stroke and the nearest edge of its label. */
const LABEL_CLEARANCE = 6;

interface WireLabelRequest {
  /** Stable wire id; seeds the deterministic spread that keeps coincident labels apart. */
  seed: string;
  label: string;
  points: Point[];
  obstacles?: RouteObstacle[];
  storedPosition?: number;
  selected: boolean;
  related: boolean;
  hovered: boolean;
  movable: boolean;
  select: () => void;
  setPosition?: (position: number) => void;
}

/** Resolved label position and renderer for one wire. */
export function useWireLabel(request: WireLabelRequest): {
  position: number;
  element: ReactNode;
} {
  const { screenToFlowPosition } = useReactFlow();
  const { setPosition } = request;
  const [dragged, setDragged] = useState<number | null>(null);
  const moved = useRef(false);
  const [labelSize, setLabelSize] = useState({ width: 0, height: 0 });
  const measureLabel = useCallback((element: HTMLButtonElement | null) => {
    if (!element) return;
    const box = element.getBoundingClientRect();
    const zoom = Number(getComputedStyle(element).getPropertyValue('--nvk-label-zoom')) || 1;
    const next = { width: box.width / zoom, height: box.height / zoom };
    setLabelSize((current) => (Math.abs(current.width - next.width) < 1
      && Math.abs(current.height - next.height) < 1 ? current : next));
  }, []);

  const spread = useMemo(() => wireLabelSpread(request.seed), [request.seed]);
  const home = DEFAULT_LABEL_POSITION + spread.along;

  /*
   * The label anchor for one route position: beside the wire, never on it. A centred label gets
   * its own route drawn through the text — on horizontal wires that reads as a strikethrough.
   * The offset lifts the label clear by its own half-extent along the route normal, so it works
   * for every wire direction, and the seeded side spreads coincident wires to opposite banks.
   */
  const anchorAt = useCallback((at: number): Point => {
    const point = pointAlong(request.points, at);
    const normal = { x: -Math.sin(point.angle), y: Math.cos(point.angle) };
    const clearance = Math.abs(normal.x) * (labelSize.width / 2)
      + Math.abs(normal.y) * (labelSize.height / 2)
      + LABEL_CLEARANCE;
    return {
      x: point.x + normal.x * clearance * spread.side,
      y: point.y + normal.y * clearance * spread.side,
    };
  }, [labelSize.height, labelSize.width, request.points, spread.side]);

  const clearPosition = useMemo(() => {
    const rects = request.obstacles ?? [];
    if (rects.length === 0) return home;
    const halfWidth = labelSize.width / 2;
    const halfHeight = labelSize.height / 2;
    const covered = (at: number): boolean => {
      const anchor = anchorAt(at);
      return rects.some(({ rect }) => anchor.x + halfWidth > rect.x
        && anchor.x - halfWidth < rect.x + rect.width
        && anchor.y + halfHeight > rect.y
        && anchor.y - halfHeight < rect.y + rect.height);
    };
    if (!covered(home)) return home;
    for (let step = 1; step <= 8; step += 1) {
      for (const at of [home - step * 0.05, home + step * 0.05]) {
        if (at > 0.06 && at < 0.94 && !covered(at)) return at;
      }
    }
    return home;
  }, [anchorAt, home, labelSize.height, labelSize.width, request.obstacles]);
  const position = dragged ?? request.storedPosition ?? clearPosition;
  const anchor = useMemo(() => anchorAt(position), [anchorAt, position]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setPosition || event.button !== 0) return;
    event.stopPropagation();
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [setPosition]);
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setPosition || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moved.current = true;
    const pointer = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setDragged(nearestPositionAlong(request.points, pointer));
  }, [request.points, screenToFlowPosition, setPosition]);
  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!setPosition || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragged !== null && moved.current) setPosition(dragged);
    setDragged(null);
  }, [dragged, setPosition]);

  const element = request.label ? (
    <EdgeLabelRenderer>
      <button
        className={`wire-label nodrag nopan${request.selected ? ' is-selected' : ''}${request.related ? ' is-related' : ''}${request.hovered ? ' is-hovered' : ''}${request.movable ? ' is-movable' : ''}`}
        onClick={(event) => { event.stopPropagation(); if (!moved.current) request.select(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={measureLabel}
        style={{
          transform: `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
          zIndex: request.selected ? 1001 : undefined,
        }}
        type="button"
      >{request.label}</button>
    </EdgeLabelRenderer>
  ) : null;
  return { position, element };
}
