import type { CSSProperties, ReactNode } from 'react';

/**
 * One edge panel of the studio.
 *
 * The shell owns the panel's geometry — which edge it sits on, how wide it is, whether it is
 * collapsed — and nothing about what is inside it. That is what lets the rail and the Studio be
 * the same object at two different edges: identical structure, different contents.
 */
export interface PanelShellProps {
  side: 'left' | 'right';
  /** Accessible name for the region; also what the collapse toggle announces. */
  label: string;
  width: number;
  collapsed?: boolean;
  /** Present only when the panel may be dragged; the handle is rendered when it is. */
  onResize?: (width: number) => void;
  children: ReactNode;
}

export function PanelShell({ children, collapsed = false, label, side, width }: PanelShellProps) {
  const style = { '--panel-width': `${width}px` } as CSSProperties;
  return (
    <aside
      aria-label={label}
      className="panel-shell"
      data-collapsed={collapsed || undefined}
      data-side={side}
      style={style}
    >
      <div className="panel-shell-inner">{children}</div>
    </aside>
  );
}
