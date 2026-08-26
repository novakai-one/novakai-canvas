import {
  useCallback, useMemo, useRef, useState,
} from 'react';
import type { RecordCommand, Selection } from '@novakai/canvas';
import { compileFlows, projectView } from '@novakai/canvas';
import { CanvasAppView } from './presentation/canvas-app/canvas-app-view';
import type { AppProps, OpenDiagram } from './presentation/canvas-app/app-contract';
import { SAVE_STATUS } from './presentation/canvas-app/save-status';
import { useCanvasPreferences } from './presentation/canvas-app/use-canvas-preferences';
import { useDiagramNavigation } from './presentation/canvas-app/use-diagram-navigation';
import { useDiagramPersistence } from './presentation/canvas-app/use-diagram-persistence';
import { useWorkspaceActions } from './presentation/canvas-app/use-workspace-actions';
import { diagramContents } from './presentation/components/diagram-contents';
import { useWorkspaceRecord } from './presentation/use-workspace-record';
import { DEFAULT_CANVAS_MODE, type CanvasMode } from './presentation/view-mode';

export type { AppProps } from './presentation/canvas-app/app-contract';

/** Composes the diagram library and one open workspace with replaceable presentation. */
export default function App(props: AppProps) {
  const {
    diagramExporter, initialDiagramId, initialPreferences, initialWorkspace, library,
    onActiveDiagramChange, preferencesRepository,
  } = props;
  const [open, setOpen] = useState<OpenDiagram>(
    () => ({ id: initialDiagramId, workspace: initialWorkspace }),
  );
  const record = useWorkspaceRecord(open.workspace);
  const view = useMemo(() => projectView(record), [record]);
  const flows = useMemo(() => compileFlows(record), [record]);
  const contents = useMemo(() => diagramContents(record, view), [record, view]);
  const activeFlowId = record.views[record.activeViewId]?.flowId;
  const [selection, setSelection] = useState<Selection>(null);
  const [saveStatus, setSaveStatus] = useState<string>(SAVE_STATUS.saved);
  const [mode, setMode] = useState<CanvasMode>(DEFAULT_CANVAS_MODE);
  const persisted = useRef(new Map<string, number>([[initialDiagramId, record.revision]]));
  const select = useCallback((next: Selection) => setSelection(next), []);

  const navigation = useDiagramNavigation({
    library, open, persisted, select, setOpen, setSaveStatus,
  });
  const preferenceState = useCanvasPreferences(
    initialPreferences, preferencesRepository, setSaveStatus,
  );
  useDiagramPersistence({
    library,
    onActiveDiagramChange,
    open,
    persisted,
    preferences: preferenceState.preferences,
    record,
    refreshDiagrams: navigation.refreshDiagrams,
    setSaveStatus,
  });
  const actions = useWorkspaceActions({
    diagramExporter, record, select, setSaveStatus, view, workspace: open.workspace,
  });
  const { executeAll } = actions;
  const { setFreshDiagramId } = navigation;

  // Mode changes what you may do, not what you are looking at — selection stays.
  const changeMode = useCallback((next: CanvasMode) => setMode(next), []);
  const executeInspectorCommands = useCallback((commands: RecordCommand[]) => {
    // The first batched act on a fresh diagram is its rename, which spends the focus flag.
    setFreshDiagramId(null);
    executeAll(commands);
  }, [executeAll, setFreshDiagramId]);

  return (
    <CanvasAppView
      actions={actions}
      activeFlowId={activeFlowId}
      changeMode={changeMode}
      contents={contents}
      executeInspectorCommands={executeInspectorCommands}
      flows={flows}
      focusTitle={open.id === navigation.freshDiagramId}
      mode={mode}
      navigation={navigation}
      open={open}
      preferences={preferenceState.preferences}
      record={record}
      saveStatus={saveStatus}
      select={select}
      selection={selection}
      setPanel={preferenceState.setPanel}
      setPreferences={preferenceState.setPreferences}
      shellStyle={preferenceState.shellStyle}
      theme={preferenceState.theme}
      view={view}
    />
  );
}
