import {
  useCallback, useState, type Dispatch, type RefObject, type SetStateAction,
} from 'react';
import type {
  CanvasLibrary, DiagramSummary, CanvasWorkspace, NodeId, Selection,
} from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import { canvasCamera } from '../canvas-camera';
import type { OpenDiagram } from './app-contract';
import { SAVE_STATUS } from './save-status';

interface DiagramNavigationOptions {
  library: CanvasLibrary;
  open: OpenDiagram;
  setOpen: Dispatch<SetStateAction<OpenDiagram>>;
  persisted: RefObject<Map<string, number>>;
  select: (selection: Selection) => void;
  setSaveStatus: (status: string) => void;
}

/** Owns library navigation and the session-local trail around the active diagram. */
export function useDiagramNavigation(options: DiagramNavigationOptions) {
  const { library, open, persisted, select, setOpen, setSaveStatus } = options;
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>(
    () => library.list({ includeArchived: true }),
  );
  const [freshDiagramId, setFreshDiagramId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const refreshDiagrams = useCallback(
    () => setDiagrams(library.list({ includeArchived: true })),
    [library],
  );

  const openDiagram = useCallback(async (diagramId: string): Promise<CanvasWorkspace | null> => {
    const opened = await library.open(diagramId);
    if (!('snapshot' in opened)) {
      console.warn('[canvas] diagram could not be opened', opened);
      setSaveStatus(SAVE_STATUS.failed);
      return null;
    }
    if (!persisted.current.has(diagramId)) {
      persisted.current.set(diagramId, opened.snapshot().revision);
    }
    setOpen({ id: diagramId, workspace: opened });
    select(null);
    setFreshDiagramId(null);
    setSaveStatus(SAVE_STATUS.saved);
    return opened;
  }, [library, persisted, select, setOpen, setSaveStatus]);

  const changeDiagram = useCallback((diagramId: string) => {
    if (diagramId === open.id) return;
    void openDiagram(diagramId);
  }, [open.id, openDiagram]);

  const openAtObject = useCallback((diagramId: string, label: string) => {
    void openDiagram(diagramId).then((opened) => {
      if (!opened) return;
      const match = Object.values(opened.snapshot().nodes).find((node) => node.label === label);
      if (!match) return;
      select({ kind: 'node', id: match.id as string });
      canvasCamera().centerOnNode(match.id as string);
    });
  }, [openDiagram, select]);

  const drillInto = useCallback((diagramId: string) => {
    const from = open.id;
    void openDiagram(diagramId).then((opened) => {
      if (opened) setHistory((trail) => [...trail, from]);
    });
  }, [open.id, openDiagram]);

  const goBack = useCallback(() => {
    const target = history.at(-1);
    if (!target) return;
    void openDiagram(target).then((opened) => {
      if (opened) setHistory((trail) => trail.slice(0, -1));
    });
  }, [history, openDiagram]);

  const createDiagram = useCallback(() => {
    const diagramId = `diagram-${crypto.randomUUID().slice(0, 8)}`;
    const name = 'Untitled diagram';
    void library.create(name, diagramId).then(async (created) => {
      if (!('nodeLabels' in created)) {
        console.warn('[canvas] diagram could not be created', created);
        setSaveStatus(SAVE_STATUS.failed);
        return;
      }
      refreshDiagrams();
      const opened = await openDiagram(diagramId);
      if (!opened) return;
      opened.execute({
        kind: 'node.add',
        node: {
          id: asId<NodeId>(diagramId), kind: 'group', label: name, interfaceIds: [], typeIds: [],
        },
        placement: { position: { x: 0, y: 0 }, size: { width: 1000, height: 700 } },
      });
      select(null);
      setFreshDiagramId(diagramId);
    });
  }, [library, openDiagram, refreshDiagrams, select, setSaveStatus]);

  const setDiagramStatus = useCallback((diagramId: string, status: 'active' | 'archived') => {
    void library.setStatus(diagramId, status).then((outcome) => {
      if (!('nodeLabels' in outcome)) {
        console.warn('[canvas] diagram status unchanged', outcome);
        setSaveStatus(SAVE_STATUS.failed);
        return;
      }
      refreshDiagrams();
      if (status !== 'archived' || diagramId !== open.id) return;
      const next = library.list().find((entry) => entry.id !== diagramId);
      if (next) void openDiagram(next.id);
    });
  }, [library, open.id, openDiagram, refreshDiagrams, setSaveStatus]);

  return {
    changeDiagram, createDiagram, diagrams, drillInto, freshDiagramId, goBack, history,
    openAtObject, openDiagram, refreshDiagrams, setDiagramStatus, setFreshDiagramId,
  };
}

export type DiagramNavigation = ReturnType<typeof useDiagramNavigation>;
