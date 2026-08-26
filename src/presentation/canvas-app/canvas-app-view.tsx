import type {
  CSSProperties, Dispatch, SetStateAction,
} from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import type {
  CanvasPreferences, DiagramRecord, FlowId, FlowLibrary, ProjectedView, RecordCommand, Selection,
} from '@novakai/canvas';
import { CanvasSurface } from '../components/canvas-surface';
import { flowStepRows } from '../components/flow-panel';
import { Inspector } from '../components/inspector';
import { Rail } from '../components/rail';
import type { ContentRow } from '../components/diagram-contents';
import { CanvasPortalProvider, ShellGeometryProvider } from '../shell';
import type { CanvasMode } from '../view-mode';
import type { OpenDiagram } from './app-contract';
import type { DiagramNavigation } from './use-diagram-navigation';
import type { WorkspaceActions } from './use-workspace-actions';

interface CanvasAppViewProps {
  actions: WorkspaceActions;
  activeFlowId?: FlowId;
  changeMode: (mode: CanvasMode) => void;
  contents: readonly ContentRow[];
  executeInspectorCommands: (commands: RecordCommand[]) => void;
  flows: FlowLibrary;
  focusTitle: boolean;
  mode: CanvasMode;
  navigation: DiagramNavigation;
  open: OpenDiagram;
  preferences: CanvasPreferences;
  record: DiagramRecord;
  saveStatus: string;
  select: (selection: Selection) => void;
  selection: Selection;
  setPanel: (patch: Partial<CanvasPreferences['panel']>) => void;
  setPreferences: Dispatch<SetStateAction<CanvasPreferences>>;
  shellStyle: CSSProperties;
  view: ProjectedView;
}

/** The three-panel Canvas shell, rendered from already-composed state and commands. */
export function CanvasAppView(props: CanvasAppViewProps) {
  const {
    actions, activeFlowId, changeMode, contents, executeInspectorCommands, flows, focusTitle,
    mode, navigation, open, preferences, record, saveStatus, select, selection, setPanel,
    setPreferences, shellStyle, view,
  } = props;
  const railCollapsed = preferences.panel.railCollapsed ?? false;
  const studioCollapsed = preferences.panel.studioCollapsed ?? false;
  const undo = () => { open.workspace.undo(); };

  return (
    <ShellGeometryProvider
      value={{
        railCollapsed,
        studioCollapsed,
        toggleRail: () => setPanel({ railCollapsed: !railCollapsed }),
        toggleStudio: () => setPanel({ studioCollapsed: !studioCollapsed }),
      }}
    >
      <div
        className={`app-shell mode-${mode}`}
        data-accent={preferences.appearance.accent}
        data-dividers={(preferences.panel.showDividers ?? true) ? undefined : 'off'}
        data-theme={preferences.appearance.theme}
        style={shellStyle}
      >
        <CanvasPortalProvider>
          <Rail
            activeDiagramId={open.id}
            activeDiagramName={record.name}
            activeFlowId={activeFlowId}
            activateFlow={(flowId) => actions.execute({ kind: 'flow.activate', flowId })}
            addNode={actions.addNode}
            canUndo={open.workspace.canUndo()}
            changeDiagram={navigation.changeDiagram}
            collapsed={railCollapsed}
            contents={contents}
            createDiagram={navigation.createDiagram}
            defaultTab={preferences.panel.leftDefaultTab ?? 'build'}
            diagrams={navigation.diagrams}
            editable={mode === 'edit'}
            flows={flows}
            flowSteps={flowStepRows(activeFlowId ? flows.get(activeFlowId) : undefined, record)}
            jumpTo={actions.jumpTo}
            openAtObject={navigation.openAtObject}
            select={select}
            selection={selection}
            setDiagramStatus={navigation.setDiagramStatus}
            setWidth={(railWidth) => setPanel({ railWidth })}
            undo={undo}
            width={preferences.panel.railWidth ?? 264}
          />
          <ReactFlowProvider>
            <CanvasSurface
              activeDiagramId={open.id}
              canGoBack={navigation.history.length > 0}
              canUndo={open.workspace.canUndo()}
              changeDiagram={navigation.changeDiagram}
              changeMode={changeMode}
              createDiagram={navigation.createDiagram}
              diagrams={navigation.diagrams}
              execute={actions.execute}
              executeAll={actions.executeAll}
              goBack={navigation.goBack}
              mode={mode}
              preferences={preferences}
              record={record}
              saveStatus={saveStatus}
              selection={selection}
              setDiagramStatus={navigation.setDiagramStatus}
              setSelection={select}
              undo={undo}
              view={view}
            />
          </ReactFlowProvider>
          <Inspector
            addInterface={actions.addInterface}
            clearSelection={() => select(null)}
            collapsed={studioCollapsed}
            copyDiagram={actions.copyDiagram}
            diagrams={navigation.diagrams}
            editable={mode === 'edit'}
            execute={actions.execute}
            executeAll={executeInspectorCommands}
            focusTitle={focusTitle}
            openDiagram={navigation.drillInto}
            preferences={preferences}
            record={record}
            select={select}
            selection={selection}
            setWidth={(width) => setPanel({ width })}
            updatePreferences={setPreferences}
            view={view}
          />
        </CanvasPortalProvider>
      </div>
    </ShellGeometryProvider>
  );
}
