import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react';
import {
  useCallback, useMemo, useRef, useState, type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  nearestPositionAlong, pointAlong, type Point, type RouteObstacle,
} from '../../domain/diagram-geometry';

const DEFAULT_LABEL_POSITION = 0.5;

interface WireLabelRequest {
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

  const clearPosition = useMemo(() => {
    const rects = request.obstacles ?? [];
    if (rects.length === 0) return DEFAULT_LABEL_POSITION;
    const halfWidth = labelSize.width / 2;
    const halfHeight = labelSize.height / 2;
    const covered = (at: number): boolean => {
      const point = pointAlong(request.points, at);
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
  }, [labelSize.height, labelSize.width, request.obstacles, request.points]);
  const position = dragged ?? request.storedPosition ?? clearPosition;
  const point = useMemo(() => pointAlong(request.points, position), [position, request.points]);

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
          transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
          zIndex: request.selected ? 1001 : undefined,
        }}
        type="button"
      >{request.label}</button>
    </EdgeLabelRenderer>
  ) : null;
  return { position, element };
}
