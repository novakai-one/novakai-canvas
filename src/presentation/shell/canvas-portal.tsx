import { useState, type ReactNode } from 'react';
import { CanvasPortalContext } from './canvas-portal-context';

/**
 * Owns the unclipped layer used by Canvas overlays.
 *
 * The target stays inside the styled Canvas root, so portalled controls inherit the current
 * theme, density and type scale instead of escaping to the host document body.
 */
export function CanvasPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  return (
    <CanvasPortalContext.Provider value={target}>
      {children}
      <div className="canvas-portal-root" ref={setTarget} />
    </CanvasPortalContext.Provider>
  );
}
