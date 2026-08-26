import { useState } from 'react';
import type { DiagramSummary } from '@novakai/canvas';
import type { Selection } from '@novakai/canvas';
import {
  ObjectRow, PanelBody, PanelCollapse, PanelHeader, PanelSection, PanelShell,
  RAIL_BOUNDS, TabStrip, clampPanelWidth,
} from '../shell';
import type { CreatableNodeKind } from '../canvas-actions';
import { BuildPalette } from './build-palette';
import { contentIndent, type ContentRow } from './diagram-contents';
import { LibraryOverlay } from './library-overlay';
import type { FlowId } from '@novakai/canvas';
import type { FlowLibrary } from '@novakai/canvas';
import { FlowSwitcher } from './flow-switcher.tsx';
import { FlowPanel, type FlowStepRow } from './flow-panel.tsx';

/** The two things the left panel is for: changing the canvas, and finding what is on it. */
const RAIL_TABS = ['build', 'contents'] as const;
export type RailTab = (typeof RAIL_TABS)[number];

/** What the rail needs to change the canvas, and to say where you are. */
export interface RailProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  activeDiagramName: string;
  flows: FlowLibrary;
  activeFlowId?: FlowId;
  activateFlow: (flowId: FlowId | undefined) => void;
  /** The active flow's resolved steps; empty in structure mode. */
  flowSteps: readonly FlowStepRow[];
  changeDiagram: (diagramId: string) => void;
  createDiagram: () => void;
  /** Travel to one object a search named: opens its diagram and lands on it. */
  openAtObject: (diagramId: string, label: string) => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
  /** Everything below here changes what is on the canvas — the rail's actual job. */
  editable: boolean;
  addNode: (kind: CreatableNodeKind) => void;
  canUndo: boolean;
  undo: () => void;
  contents: readonly ContentRow[];
  selection: Selection;
  /** Peek: selects and leaves the camera exactly where it is. */
  select: (selection: Selection) => void;
  /** Travel: selects and eases the canvas to it. */
  jumpTo: (selection: Selection) => void;
  width: number;
  collapsed: boolean;
  setWidth: (width: number) => void;
  defaultTab: RailTab;
}

/** What is on the canvas, as a list you can peek at or travel to. */
function ContentsTab(props: RailProps) {
  if (props.contents.length === 0) {
    return (
      <PanelSection fill title="Objects">
        <div className="panel-empty">
          <span className="panel-empty-mark" aria-hidden>⌁</span>
          <span>Nothing drawn yet</span>
        </div>
      </PanelSection>
    );
  }
  const selectedId = props.selection?.kind === 'node' ? props.selection.id : null;
  return (
    <PanelSection
      fill
      title="Objects"
      trailing={<span className="rail-count">{props.contents.length}</span>}
    >
      <ul className="object-rows">
        {props.contents.map((row) => (
          <ObjectRow
            indent={contentIndent(row.depth)}
            key={row.id}
            kind={row.kind}
            label={row.label}
            onJump={() => props.jumpTo({ kind: 'node', id: row.id })}
            onPeek={() => props.select({ kind: 'node', id: row.id })}
            selected={row.id === selectedId}
          />
        ))}
      </ul>
    </PanelSection>
  );
}

/**
 * The left rail: everything that changes the canvas, and nothing else.
 *
 * It used to be a nineteen-row file list occupying a full column permanently, which answered a
 * question asked once a session and then held the space for the rest of it. Choosing a diagram
 * moved into an overlay behind the diagram's own name; what took its place is the work — the
 * shapes, and the list of what is already drawn.
 *
 * The rows never move. Every row in the Build tab is in the same place whatever is happening,
 * because a menu that reflows under the hand cannot be learned.
 */
export function Rail(props: RailProps) {
  const [tab, setTab] = useState<RailTab>(props.defaultTab);
  const [library, setLibrary] = useState<{ top: number; left: number } | null>(null);
  const width = clampPanelWidth(props.width, RAIL_BOUNDS, 264);

  return (
    <PanelShell
      bounds={RAIL_BOUNDS}
      collapsed={props.collapsed}
      label="Diagrams"
      onResize={props.setWidth}
      side="left"
      width={width}
    >
      <PanelHeader
        actions={<PanelCollapse side="left" />}
        kind=">_ novakai"
        title="Canvas"
        meta=""
      />
      <div className="rail-switcher">
        <button
          aria-expanded={library !== null}
          aria-haspopup="dialog"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            setLibrary((open) => (open ? null : { top: box.bottom + 4, left: box.left }));
          }}
          title={props.activeDiagramName}
          type="button"
        >
          <span className="rail-switcher-name">{props.activeDiagramName}</span>
          <span aria-hidden className="rail-switcher-mark">▾</span>
        </button>
        {library && (
          <LibraryOverlay
            activeDiagramId={props.activeDiagramId}
            at={library}
            changeDiagram={props.changeDiagram}
            close={() => setLibrary(null)}
            createDiagram={props.createDiagram}
            diagrams={props.diagrams}
            openAtObject={props.openAtObject}
            setDiagramStatus={props.setDiagramStatus}
          />
        )}
      </div>
      <FlowSwitcher
        activeFlowId={props.activeFlowId}
        flows={props.flows}
        onSelect={props.activateFlow}
      />
      <FlowPanel
        onSelectWire={(wireId) => props.select({ kind: 'wire', id: wireId })}
        rows={props.flowSteps}
        selection={props.selection}
      />
      <TabStrip active={tab} label="Left panel surfaces" onSelect={setTab} tabs={RAIL_TABS} />
      <PanelBody>
        {tab === 'build' ? <BuildPalette {...props} /> : <ContentsTab {...props} />}
      </PanelBody>
    </PanelShell>
  );
}
