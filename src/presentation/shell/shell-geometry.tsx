import { createContext, useContext, type ReactNode } from 'react';

/** Whether each edge is open, and the one way to change that. */
export interface ShellGeometry {
  railCollapsed: boolean;
  studioCollapsed: boolean;
  toggleRail: () => void;
  toggleStudio: () => void;
}

const NOTHING_COLLAPSED: ShellGeometry = {
  railCollapsed: false,
  studioCollapsed: false,
  toggleRail: () => {},
  toggleStudio: () => {},
};

const Context = createContext<ShellGeometry>(NOTHING_COLLAPSED);

/**
 * Panel geometry, offered to whatever chrome needs to govern it.
 *
 * The controls belong over the canvas — that is the only place reachable whether a panel is
 * open or closed — but the canvas surface is not this shell's to thread props through. A
 * context is the honest seam: the shell publishes its geometry, and the chrome that draws the
 * toggles reads it without anything in between having to know they exist.
 */
export function ShellGeometryProvider({ children, value }: { value: ShellGeometry; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useShellGeometry(): ShellGeometry {
  return useContext(Context);
}
