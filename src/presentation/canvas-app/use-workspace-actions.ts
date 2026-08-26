import { useCallback } from 'react';
import type {
  CanvasWorkspace, DiagramExportFormat, DiagramExportService, DiagramRecord, InterfaceId,
  NodeId, ProjectedView, RecordCommand, Selection,
} from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import { createCanvasNode, placedNodes, type CreatableNodeKind } from '../canvas-actions';
import { canvasCamera } from '../canvas-camera';
import { SAVE_STATUS } from './save-status';

interface WorkspaceActionOptions {
  diagramExporter: DiagramExportService;
  record: DiagramRecord;
  select: (selection: Selection) => void;
  setSaveStatus: (status: string) => void;
  view: ProjectedView;
  workspace: CanvasWorkspace;
}

/** Adapts UI intentions to the active workspace's command interface. */
export function useWorkspaceActions(options: WorkspaceActionOptions) {
  const { diagramExporter, record, select, setSaveStatus, view, workspace } = options;

  /** Several commands, one revision, one undo. */
  const executeAll = useCallback((commands: RecordCommand[]) => {
    if (commands.length === 0) return;
    const outcome = workspace.submit({
      operationId: `studio-${crypto.randomUUID()}`,
      expectedRevision: workspace.snapshot().revision,
      timestamp: new Date().toISOString(),
      commands,
    });
    if (outcome.status === 'applied') return;
    console.warn('[canvas] batch not applied', outcome, commands);
    setSaveStatus(SAVE_STATUS.refused);
  }, [setSaveStatus, workspace]);

  const execute = useCallback((command: RecordCommand) => {
    const outcome = workspace.execute(command);
    if (outcome.status === 'applied') return;
    console.warn('[canvas] change not applied', outcome, command);
    setSaveStatus(SAVE_STATUS.refused);
  }, [setSaveStatus, workspace]);

  const addNode = useCallback((kind: CreatableNodeKind) => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(placedNodes(view), kind, id, canvasCamera().focusPoint());
    execute({ kind: 'node.add', ...created });
    select({ kind: 'node', id: created.node.id });
  }, [execute, select, view]);

  const addInterface = useCallback((ownerId: string) => {
    const id = `iface-${crypto.randomUUID().slice(0, 8)}`;
    execute({
      kind: 'interface.add',
      ownerId,
      iface: {
        id: asId<InterfaceId>(id), ownerId: asId<NodeId>(ownerId),
        name: 'newCall', accepts: [], returns: [],
      },
    });
    select({ kind: 'interface', id });
  }, [execute, select]);

  /** Travel to an object: select it, then let the camera ease to it. */
  const jumpTo = useCallback((next: Selection) => {
    select(next);
    if (next?.kind === 'node') canvasCamera().centerOnNode(next.id);
  }, [select]);

  const copyDiagram = useCallback(async (format: DiagramExportFormat): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(await diagramExporter.render([record], format));
      return true;
    } catch (error) {
      console.warn('[canvas] diagram copy failed', error);
      setSaveStatus('Could not copy');
      return false;
    }
  }, [diagramExporter, record, setSaveStatus]);

  return { addInterface, addNode, copyDiagram, execute, executeAll, jumpTo };
}

export type WorkspaceActions = ReturnType<typeof useWorkspaceActions>;
