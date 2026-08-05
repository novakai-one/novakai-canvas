import type { ReactNode } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { CanvasLayout, DiagramRecord, NodePlacement } from '../../domain/records';
import { rootGroupId } from '../canvas-actions';
import { scopeDepth } from '../projection';
import { FieldRow, ObjectRow, PanelSection, SwitchRow } from '../shell';

/** Everything the inspector reads about the open diagram and the library around it. */
export interface InspectPanelProps {
  record: DiagramRecord;
  /** Only what is visible, so the contents list matches what is on screen. */
  view: ProjectedView;
  selection: Selection;
  execute: (command: RecordCommand) => void;
  clearSelection: () => void;
  /** Peek: selects the object and leaves the camera exactly where it is. */
  select: (selection: Selection) => void;
  /**
   * Travel: selects the object and eases the canvas to it.
   *
   * Separated from `select` because peek and travel are different acts — the seam the camera
   * work fills in. Until it does, travelling simply peeks, which is never wrong, only quiet.
   */
  jumpTo?: (selection: Selection) => void;
  editable: boolean;
  diagrams: DiagramSummary[];
  openDiagram: (diagramId: string) => void;
}

/**
 * What a panel needs to draw one selection.
 *
 * Header and body are returned separately and the panel assembles them, which is what makes the
 * Studio's skeleton impossible to vary: no selection view can draw its own header.
 */
export interface Inspection {
  kind: string;
  title: string;
  meta: string;
  body: ReactNode;
}

function activeLayout(record: DiagramRecord): CanvasLayout | undefined {
  return record.layouts[record.views[record.activeViewId]?.layoutId];
}

function placementOf(record: DiagramRecord, nodeId: string): Pick<NodePlacement, 'position' | 'pinned'> {
  const placement = activeLayout(record)?.placements[nodeId];
  return { position: placement?.position ?? { x: 0, y: 0 }, pinned: placement?.pinned ?? false };
}

function depthOf(record: DiagramRecord, nodeId: string): number {
  const node = record.nodes[nodeId];
  return node ? scopeDepth(record.nodes, node) : 0;
}

/**
 * What the panel shows when nothing is selected.
 *
 * Listing what the open diagram contains costs no extra chrome and turns the largest empty area
 * on screen into the fastest way to reach any object in it.
 */
function diagramContents(props: InspectPanelProps): ReactNode {
  const { record, view } = props;
  const rootId = rootGroupId(record);
  const jump = props.jumpTo ?? props.select;
  const listed = view.nodes
    .filter((node) => node.id !== rootId)
    .sort((left, right) => depthOf(record, left.id) - depthOf(record, right.id)
      || left.label.localeCompare(right.label));

  if (listed.length === 0) {
    return (
      <PanelSection fill title="Contents">
        <div className="panel-empty">
          <span className="panel-empty-mark" aria-hidden>⌁</span>
          <span>Nothing drawn yet</span>
        </div>
      </PanelSection>
    );
  }

  return (
    <PanelSection fill title="Contents">
      <ul className="object-rows">
        {listed.map((node) => (
          <ObjectRow
            indent={Math.min(depthOf(record, node.id) - 1, 3) * 8}
            key={node.id}
            kind={node.kind}
            label={node.label}
            onJump={() => jump({ kind: 'node', id: node.id })}
            onPeek={() => props.select({ kind: 'node', id: node.id })}
            selected={false}
          />
        ))}
      </ul>
    </PanelSection>
  );
}

function diagramInspection(props: InspectPanelProps): Inspection {
  const objects = props.view.nodes.filter((node) => node.id !== rootGroupId(props.record)).length;
  return {
    kind: 'Diagram',
    title: props.record.name,
    meta: `${objects} objects · ${props.view.wires.length} wires · r${props.record.revision}`,
    body: diagramContents(props),
  };
}

function nodeInspection(props: InspectPanelProps, id: string): Inspection {
  const node = props.record.nodes[id];
  if (!node) return diagramInspection(props);
  const placement = placementOf(props.record, id);
  const detail = node.expandsToDiagramId
    ? props.diagrams.find((entry) => entry.id === node.expandsToDiagramId)
    : undefined;
  const isRoot = id === rootGroupId(props.record);
  const parent = node.parentId ? props.record.nodes[node.parentId] : undefined;
  // The record owns its own title, and the root container shows that title on the canvas. Renaming
  // one without the other would put two different names on one diagram, so they move together.
  const rename = (label: string): void => {
    props.execute({ kind: 'node.update', id, patch: { label } });
    if (isRoot && label.trim().length > 0) props.execute({ kind: 'diagram.rename', name: label });
  };
  return {
    kind: node.kind,
    title: node.label,
    meta: isRoot ? 'Diagram container' : `in ${parent?.label ?? props.record.name}`,
    body: (
      <>
        <PanelSection title="Identity">
          <FieldRow label="Name">
            <input disabled={!props.editable} onChange={(event) => rename(event.target.value)} value={node.label} />
          </FieldRow>
          <FieldRow label="Description">
            <textarea
              disabled={!props.editable}
              onChange={(event) => props.execute({ kind: 'node.update', id, patch: { description: event.target.value } })}
              value={node.description ?? ''}
            />
          </FieldRow>
        </PanelSection>
        <PanelSection title="Facts">
          <div className="fact-grid">
            <div><span>Interfaces</span><strong>{node.interfaceIds.length}</strong></div>
            <div><span>Types</span><strong>{node.typeIds.length}</strong></div>
            <div><span>Position</span><strong>{Math.round(placement.position.x)}, {Math.round(placement.position.y)}</strong></div>
          </div>
          {node.subjectRef && (
            <FieldRow label="Subject"><output>{node.subjectRef.namespace}:{node.subjectRef.id}</output></FieldRow>
          )}
          {node.expandsToDiagramId && (
            <FieldRow label="Detail diagram"><output>{detail?.name ?? node.expandsToDiagramId}</output></FieldRow>
          )}
          {detail?.status === 'active' && (
            <button className="panel-button" onClick={() => props.openDiagram(detail.id)} type="button">Open detail →</button>
          )}
        </PanelSection>
        <PanelSection title="Placement">
          <SwitchRow
            checked={placement.pinned}
            disabled={!props.editable}
            label="Lock position"
            onChange={(pinned) => props.execute({ kind: 'node.pin', id, pinned })}
          />
          {node.kind === 'group' && (
            <SwitchRow
              checked={props.view.collapsedNodeIds.includes(node.id)}
              disabled={!props.editable}
              label="Collapse children"
              onChange={(collapsed) => props.execute({ kind: 'view.setCollapsed', id, collapsed })}
            />
          )}
        </PanelSection>
        {props.editable && !isRoot && (
          <PanelSection>
            <button
              className="panel-button"
              data-tone="danger"
              onClick={() => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); }}
              type="button"
            >
              Delete object
            </button>
          </PanelSection>
        )}
      </>
    ),
  };
}

function interfaceInspection(props: InspectPanelProps, id: string): Inspection {
  const item = props.record.interfaces[id];
  if (!item) return diagramInspection(props);
  return {
    kind: 'Interface',
    title: item.name,
    meta: `on ${props.record.nodes[item.ownerId]?.label ?? item.ownerId}`,
    body: (
      <PanelSection title="Signature">
        <FieldRow label="Owner"><output>{props.record.nodes[item.ownerId]?.label ?? item.ownerId}</output></FieldRow>
        <FieldRow label="Accepts"><output>{item.accepts.join(', ') || 'Nothing'}</output></FieldRow>
        <FieldRow label="Returns"><output>{item.returns.join(', ') || 'void'}</output></FieldRow>
      </PanelSection>
    ),
  };
}

function typeInspection(props: InspectPanelProps, id: string): Inspection {
  const item = props.record.types[id];
  if (!item) return diagramInspection(props);
  const usedBy = Object.values(props.record.nodes)
    .filter((node) => (node.typeIds as string[]).includes(id));
  return {
    kind: 'Type',
    title: item.name,
    meta: `${item.fields.length} fields · used by ${usedBy.length}`,
    body: (
      <PanelSection title="Shape">
        <div className="token-row">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
        <FieldRow label="Used by"><output>{usedBy.map((node) => node.label).join(', ') || 'Nothing yet'}</output></FieldRow>
      </PanelSection>
    ),
  };
}

function wireInspection(props: InspectPanelProps, id: string): Inspection {
  const wire = props.record.wires[id];
  if (!wire) return diagramInspection(props);
  const from = props.record.nodes[wire.source.nodeId]?.label ?? wire.source.nodeId;
  const to = props.record.nodes[wire.target.nodeId]?.label ?? wire.target.nodeId;
  return {
    kind: 'Wire',
    title: wire.label || 'Unlabelled',
    meta: `${from} → ${to}`,
    body: (
      <>
        <PanelSection title="Relationship">
          <FieldRow label="Label"><output>{wire.label || 'Unlabelled'}</output></FieldRow>
          <FieldRow label="Kind"><output>{wire.kind}</output></FieldRow>
          <FieldRow label="From"><output>{from}</output></FieldRow>
          <FieldRow label="To"><output>{to}</output></FieldRow>
        </PanelSection>
        <PanelSection title="Routing">
          <FieldRow label="Path"><output>Elbow</output></FieldRow>
        </PanelSection>
        {props.editable && (
          <PanelSection>
            <button
              className="panel-button"
              data-tone="danger"
              onClick={() => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); }}
              type="button"
            >
              Delete wire
            </button>
          </PanelSection>
        )}
      </>
    ),
  };
}

function treeRowInspection(props: InspectPanelProps, nodeId: string, rowId: string): Inspection {
  const node = props.record.nodes[nodeId];
  const row = node?.rows?.find((item) => item.id === rowId);
  if (!node || !row) return diagramInspection(props);
  const parent = row.parentRowId ? node.rows?.find((item) => item.id === row.parentRowId) : undefined;
  return {
    kind: row.kind,
    title: row.label ?? row.id,
    meta: `in ${node.label}`,
    body: (
      <PanelSection title="Row">
        <FieldRow label="Status"><output>{row.status ?? '—'}</output></FieldRow>
        <FieldRow label="Parent"><output>{parent ? parent.id : 'top level'}</output></FieldRow>
        {row.badges.length > 0 && (
          <div className="token-row">{row.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
        )}
      </PanelSection>
    ),
  };
}

/** Describes the current selection: what it is, what it is called, and what to show about it. */
export function describeSelection(props: InspectPanelProps): Inspection {
  const selection = props.selection;
  if (!selection) return diagramInspection(props);
  if (selection.kind === 'node') return nodeInspection(props, selection.id);
  if (selection.kind === 'interface') return interfaceInspection(props, selection.id);
  if (selection.kind === 'type') return typeInspection(props, selection.id);
  if (selection.kind === 'tree-row') return treeRowInspection(props, selection.nodeId, selection.rowId);
  return wireInspection(props, selection.id);
}
