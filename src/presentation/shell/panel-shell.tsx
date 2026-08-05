import { useCallback, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { widthFromDrag, type PanelBounds } from './panel-width';

/**
 * One edge panel of the studio.
 *
 * The shell owns the panel's geometry — which edge it sits on, how wide it is, whether it is
 * collapsed — and nothing about what is inside it. That is what lets the rail and the Studio be
 * the same object at two different edges: identical structure, different contents.
 *
 * A panel is laid out in the flow, never over it, so opening, closing, and dragging one pushes
 * the canvas rather than covering it. The width is what animates, at the structural pace — and
 * only when it is not being dragged, because a handle that lags 700ms behind the pointer feels
 * broken rather than calm.
 */
export interface PanelShellProps {
  side: 'left' | 'right';
  /** Accessible name for the region. */
  label: string;
  width: number;
  bounds: PanelBounds;
  collapsed?: boolean;
  /** Present only when the panel may be dragged; the handle is rendered when it is. */
  onResize?: (width: number) => void;
  children: ReactNode;
}

export function PanelShell({
  bounds, children, collapsed = false, label, onResize, side, width,
}: PanelShellProps) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const start = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!onResize) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }, [onResize, width]);

  const move = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || !onResize || active.pointerId !== event.pointerId) return;
    onResize(widthFromDrag(side, active.startWidth, event.clientX - active.startX, bounds));
  }, [bounds, onResize, side]);

  const end = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  }, []);

  const style = { '--panel-width': collapsed ? '0px' : `${width}px` } as CSSProperties;
  return (
    <aside
      aria-label={label}
      className="panel-shell"
      data-collapsed={collapsed || undefined}
      data-dragging={dragging || undefined}
      data-side={side}
      style={style}
    >
      <div className="panel-shell-inner" style={{ width: `${width}px` }}>{children}</div>
      {onResize && !collapsed && (
        <div
          aria-hidden
          className="panel-resize"
          onPointerCancel={end}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
        />
      )}
    </aside>
  );
}
