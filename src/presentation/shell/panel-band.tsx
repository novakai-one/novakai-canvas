import type { ReactNode } from 'react';

/**
 * The band under a panel header.
 *
 * The Studio fills it with its tab strip, the rail with its filter. It exists so both panels
 * have the same three-part shape — header, band, body — rather than one having a strip and the
 * other starting straight into content.
 */
export function PanelBand({ children }: { children: ReactNode }) {
  return <div className="panel-band">{children}</div>;
}

/** The one pinned block at the foot of a panel: the action the panel exists to offer. */
export function PanelFooter({ children }: { children: ReactNode }) {
  return <div className="panel-footer">{children}</div>;
}
