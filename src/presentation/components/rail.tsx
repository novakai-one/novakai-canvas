import { useState } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { Selection } from '../../domain/model';
import {
  Flyout, ObjectRow, PanelBody, PanelCollapse, PanelHeader, PanelSection, PanelShell,
  RAIL_BOUNDS, TabStrip, clampPanelWidth,
} from '../shell';
import type { CreatableNodeKind } from '../canvas-actions';
import { contentIndent, type ContentRow } from './diagram-contents';
import { LibraryOverlay } from './library-overlay';

/** The two things the left panel is for: changing the canvas, and finding what is on it. */
const RAIL_TABS = ['build', 'contents'] as const;
export type RailTab = (typeof RAIL_TABS)[number];

/**
 * The four kinds one Shape can be.
 *
 * They are one row and a flyout rather than four buttons because they are the same act — put a
 * box on the canvas — differing only in what the box means. Four peers beside Group and Note
 * said all six were the same sort of thing, and they are not: Group is a container and Note is
 * annotation, while these four are just a property of the shape you placed.
 */
const SHAPE_KINDS: readonly { id: CreatableNodeKind; label: string; hint: string }[] = [
  { id: 'module', label: 'Module', hint: 'A part that does something' },
  { id: 'object', label: 'Object', hint: 'A thing that is passed around' },
  { id: 'runtime', label: 'Runtime', hint: 'Something running' },
  { id: 'resource', label: 'Resource', hint: 'Something stored or external' },
];

/** What the rail needs to change the canvas, and to say where you are. */
export interface RailProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  activeDiagramName: string;
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

/**
 * The three things you can put on a canvas, and they are not peers.
 *
 * Shape is the one you reach for; its kind is a choice inside it. Group contains other shapes.
 * Note is annotation and is not part of the model at all. The hierarchy is in the layout, not
 * in a label explaining it.
 */
function BuildTab(props: RailProps) {
  const [kind, setKind] = useState<CreatableNodeKind>('module');
  const chosen = SHAPE_KINDS.find((entry) => entry.id === kind) ?? SHAPE_KINDS[0];

  return (
    <>
      <PanelSection title="Shape">
        <div className="build-rows">
          <div className="build-row build-row--primary">
            <button
              className="build-place"
              disabled={!props.editable}
              onClick={() => props.addNode(kind)}
              type="button"
            >
              <span className="build-row-label">Shape</span>
              <span className="build-row-kind">{chosen.label}</span>
            </button>
            <Flyout
              current={kind}
              items={SHAPE_KINDS}
              label="What kind"
              onPick={(picked) => setKind(picked as CreatableNodeKind)}
            >
              <span className="build-row-change">Kind</span>
            </Flyout>
          </div>
          <div className="build-row">
            <button
              className="build-place"
              disabled={!props.editable}
              onClick={() => props.addNode('group')}
              type="button"
            >
              <span className="build-row-label">Group</span>
              <span className="build-row-kind">Contains shapes</span>
            </button>
          </div>
          <div className="build-row">
            <button
              className="build-place"
              disabled={!props.editable}
              onClick={() => props.addNode('comment')}
              type="button"
            >
              <span className="build-row-label">Note</span>
              <span className="build-row-kind">Not part of the model</span>
            </button>
          </div>
        </div>
      </PanelSection>
      <PanelSection title="History">
        <button
          className="panel-button"
          disabled={!props.editable || !props.canUndo}
          onClick={props.undo}
          type="button"
        >
          Undo last change
        </button>
      </PanelSection>
    </>
  );
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
      <TabStrip active={tab} label="Left panel surfaces" onSelect={setTab} tabs={RAIL_TABS} />
      <PanelBody>
        {tab === 'build' ? <BuildTab {...props} /> : <ContentsTab {...props} />}
      </PanelBody>
    </PanelShell>
  );
}
