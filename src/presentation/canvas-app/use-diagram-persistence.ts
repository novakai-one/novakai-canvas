import { useEffect, type RefObject } from 'react';
import type {
  CanvasLibrary, CanvasPreferences, DiagramRecord,
} from '@novakai/canvas';
import type { OpenDiagram } from './app-contract';
import { SAVE_STATUS } from './save-status';

interface DiagramPersistenceOptions {
  library: CanvasLibrary;
  open: OpenDiagram;
  record: DiagramRecord;
  preferences: CanvasPreferences;
  persisted: RefObject<Map<string, number>>;
  refreshDiagrams: () => void;
  setSaveStatus: (status: string) => void;
  onActiveDiagramChange?: (diagramId: string) => void;
}

/** Reports navigation and debounces writes of the active in-memory diagram. */
export function useDiagramPersistence(options: DiagramPersistenceOptions): void {
  const {
    library, onActiveDiagramChange, open, persisted, preferences, record,
    refreshDiagrams, setSaveStatus,
  } = options;

  useEffect(() => {
    onActiveDiagramChange?.(open.id);
  }, [onActiveDiagramChange, open.id]);

  useEffect(() => {
    if (!preferences.files.autoSave) return;
    if (persisted.current.get(open.id) === record.revision) return;
    setSaveStatus(SAVE_STATUS.saving);
    const timer = window.setTimeout(() => {
      const saving = open.workspace.snapshot().revision;
      void library.save(open.id).then((outcome) => {
        if (outcome.status === 'written') {
          persisted.current.set(open.id, saving);
          setSaveStatus(SAVE_STATUS.saved);
          refreshDiagrams();
          return;
        }
        // Keep unsaved edits when another process has written the record underneath this session.
        setSaveStatus(outcome.status === 'stale-revision' ? SAVE_STATUS.stale : SAVE_STATUS.failed);
      });
    }, preferences.files.saveDelay);
    return () => window.clearTimeout(timer);
  }, [library, open, persisted, preferences.files.autoSave, preferences.files.saveDelay,
    record, refreshDiagrams, setSaveStatus]);
}
