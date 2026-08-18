import { createContext, useContext } from 'react';

/** Host-owned visibility for Canvas controls with document-level listeners. */
export const CanvasActivityContext = createContext(true);

/** Whether this Canvas instance currently owns user interaction in its host. */
export function useCanvasActivity(): boolean {
  return useContext(CanvasActivityContext);
}
