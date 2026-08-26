import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CanvasPreferences, JsonRepository } from '@novakai/canvas';
import { wireToneCssVariables } from '@novakai/canvas';
import { targetScale } from '../shell';

/** How much air each density setting puts between things, as a multiplier on the 4px grid. */
const DENSITY_SCALE: Record<CanvasPreferences['appearance']['density'], number> = {
  compact: 0.85,
  comfortable: 1,
  roomy: 1.25,
};

/** Owns preference editing, persistence, and the CSS variables derived from preferences. */
export function useCanvasPreferences(
  initialPreferences: CanvasPreferences,
  repository: JsonRepository<CanvasPreferences>,
  setSaveStatus: (status: string) => void,
) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const savedPreferences = useRef(JSON.stringify(initialPreferences));

  useEffect(() => {
    const serialized = JSON.stringify(preferences);
    if (serialized === savedPreferences.current) return;
    const timer = window.setTimeout(() => {
      void repository.save(preferences)
        .then(() => { savedPreferences.current = serialized; })
        .catch(() => setSaveStatus('Preferences not saved'));
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [preferences, repository, setSaveStatus]);

  /** Panel geometry is a preference, not session state. */
  const setPanel = useCallback((patch: Partial<CanvasPreferences['panel']>) => {
    setPreferences((current) => ({ ...current, panel: { ...current.panel, ...patch } }));
  }, []);

  const shellStyle = {
    '--density': String(DENSITY_SCALE[preferences.appearance.density] ?? 1),
    '--text-scale': String(preferences.appearance.textScale ?? 1),
    '--target-scale': String(targetScale(preferences.canvas.targetSize ?? 'medium').multiplier),
    '--node-radius': `${preferences.appearance.radius}px`,
    ...wireToneCssVariables(preferences.appearance.theme),
  } as CSSProperties;

  return { preferences, setPanel, setPreferences, shellStyle };
}
