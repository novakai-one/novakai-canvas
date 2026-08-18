import type { ReactNode } from 'react';
import { CanvasActivityContext } from './canvas-activity-context';

/** Supplies host-owned visibility without coupling Canvas controls to a particular host. */
export function CanvasActivityProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <CanvasActivityContext.Provider value={active}>
      {children}
    </CanvasActivityContext.Provider>
  );
}
