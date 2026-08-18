import { createContext, useContext } from 'react';

/** The Canvas-local DOM destination shared by overlay producers and the host shell. */
export const CanvasPortalContext = createContext<HTMLElement | null>(null);

/** The nearest Canvas-owned portal target, unavailable only during the provider's first render. */
export function useCanvasPortalTarget(): HTMLElement | null {
  return useContext(CanvasPortalContext);
}
