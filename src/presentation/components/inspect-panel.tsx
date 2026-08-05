import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { CanvasLayout, DiagramRecord, NodePlacement } from '../../domain/records';
import { rootGroupId } from '../canvas-actions';
import { scopeDepth } from '../projection';
import { Field } from './field';

/** Everything the inspector reads about the open diagram and the library around it. */
export interface InspectPanelProps {
  record: DiagramRecord;
  /** Only what is visible, so the contents list matches what is on screen. */
  view: ProjectedView;
  selection: Selection;
  execute: (command: RecordCommand) => void;
  clearSelection: () => void;
  select: (selection: Selection) => void;
  editable: boolean;
  diagrams: DiagramSummary[];
  openDiagram: (diagramId: string) => void;
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
 * It used to be one grey sentence in four hundred pixels of nothing. Listing what the open
 * diagram contains costs no extra chrome and turns the largest empty area on screen into the
 * fastest way to reach any object in it.
 */
function DiagramContents({ props }: { props: InspectPanelProps }) {
  const { record, view } = props;
  const rootId = rootGroupId(record);
  const listed = view.nodes
    .filter((node) => node.id !== rootId)
    .sort((left, right) => depthOf(record, left.id) - depthOf(record, right.id)
      || left.label.localeCompare(right.label));

  if (listed.length === 0) {
    return <div className="empty-inspector"><span className="empty-mark">⌁</span><span>Nothing drawn yet</span></div>;
  }

  return (
    <div className="diagram-contents">
      <header>
        <strong>{record.name}</strong>
        <small>{listed.length} objects · {view.wires.length} wires</small>
      </header>
      <ul>
        {listed.map((node) => (
          <li key={node.id} style={{ paddingLeft: `${Math.min(depthOf(record, node.id) - 1, 3) * 10}px` }}>
            <button onClick={() => props.select({ kind: 'node', id: node.id })} type="button">
              <span className="contents-kind">{node.kind}</span>
              <span className="contents-label">{node.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptySelection({ props }: { props: InspectPanelProps }) {
  return <DiagramContents props={props} />;
}

function NodeInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const node = props.record.nodes[id];
  if (!node) return <EmptySelection props={props} />;
  const placement = placementOf(props.record, id);
  const detail = node.expandsToDiagramId
    ? props.diagrams.find((entry) => entry.id === node.expandsToDiagramId)
    : undefined;
  const isRoot = id === rootGroupId(props.record);
  // The record owns its own title, and the root container shows that title on the canvas. Renaming
  // one without the other would put two different names on one diagram, so they move together.
  const rename = (label: string): void => {
    props.execute({ kind: 'node.update', id, patch: { label } });
    if (isRoot && label.trim().length > 0) props.execute({ kind: 'diagram.rename', name: label });
  };
  return (
    <div className="inspection">
      <div className="object-identity"><span>{node.kind}</span><strong>{node.label}</strong></div>
      <Field label="Name">
        <input disabled={!props.editable} value={node.label} onChange={(event) => rename(event.target.value)} />
      </Field>
      <Field label="Description">
        <textarea disabled={!props.editable} value={node.description ?? ''} onChange={(event) => props.execute({ kind: 'node.update', id, patch: { description: event.target.value } })} />
      </Field>
      <div className="facts">
        <div><span>Interfaces</span><strong>{node.interfaceIds.length}</strong></div>
        <div><span>Types</span><strong>{node.typeIds.length}</strong></div>
        <div><span>Position</span><strong>{Math.round(placement.position.x)}, {Math.round(placement.position.y)}</strong></div>
      </div>
      {node.subjectRef && (
        <Field label="Subject"><output>{node.subjectRef.namespace}:{node.subjectRef.id}</output></Field>
      )}
      {node.expandsToDiagramId && (
        <Field label="Detail diagram"><output>{detail?.name ?? node.expandsToDiagramId}</output></Field>
      )}
      {detail?.status === 'active' && (
        <button onClick={() => props.openDiagram(detail.id)} type="button">Open detail →</button>
      )}
      {props.editable && (
        <Field label="Lock position">
          <input
            checked={placement.pinned}
            onChange={(event) => props.execute({ kind: 'node.pin', id, pinned: event.target.checked })}
            type="checkbox"
          />
        </Field>
      )}
      {props.editable && node.kind === 'group' && (
        <Field label="Collapse children">
          <input
            checked={props.view.collapsedNodeIds.includes(node.id)}
            onChange={(event) => props.execute({ kind: 'view.setCollapsed', id, collapsed: event.target.checked })}
            type="checkbox"
          />
        </Field>
      )}
      {props.editable && !isRoot && (
        <button className="danger-action" onClick={() => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); }} type="button">Delete object</button>
      )}
    </div>
  );
}

function InterfaceInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const item = props.record.interfaces[id];
  if (!item) return <EmptySelection props={props} />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>interface</span><strong>{item.name}</strong></div>
      <Field label="Owner"><output>{props.record.nodes[item.ownerId]?.label ?? item.ownerId}</output></Field>
      <Field label="Accepts"><output>{item.accepts.join(', ') || 'Nothing'}</output></Field>
      <Field label="Returns"><output>{item.returns.join(', ') || 'void'}</output></Field>
      <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
    </div>
  );
}

function TypeInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const item = props.record.types[id];
  if (!item) return <EmptySelection props={props} />;
  const usedBy = Object.values(props.record.nodes)
    .filter((node) => (node.typeIds as string[]).includes(id));
  return (
    <div className="inspection">
      <div className="object-identity"><span>type</span><strong>{item.name}</strong></div>
      <div className="token-list">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
      <Field label="Used by"><output>{usedBy.map((node) => node.label).join(', ')}</output></Field>
      <pre className="object-json">{JSON.stringify(item, null, 2)}</pre>
    </div>
  );
}

function WireInspection({ props, id }: { props: InspectPanelProps; id: string }) {
  const wire = props.record.wires[id];
  if (!wire) return <EmptySelection props={props} />;
  return (
    <div className="inspection">
      <div className="object-identity"><span>wire · {wire.kind}</span><strong>{wire.label || 'Unlabelled'}</strong></div>
      <Field label="Label"><output>{wire.label || 'Unlabelled'}</output></Field>
      <Field label="Kind"><output>{wire.kind}</output></Field>
      <Field label="From"><output>{props.record.nodes[wire.source.nodeId]?.label ?? wire.source.nodeId}</output></Field>
      <Field label="To"><output>{props.record.nodes[wire.target.nodeId]?.label ?? wire.target.nodeId}</output></Field>
      <Field label="Routing"><output>Elbow</output></Field>
      {props.editable && <button className="danger-action" onClick={() => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); }} type="button">Delete wire</button>}
    </div>
  );
}

function TreeRowInspection({ props, nodeId, rowId }: { props: InspectPanelProps; nodeId: string; rowId: string }) {
  const node = props.record.nodes[nodeId];
  const row = node?.rows?.find((item) => item.id === rowId);
  if (!node || !row) return <EmptySelection props={props} />;
  const parent = row.parentRowId ? node.rows?.find((item) => item.id === row.parentRowId) : undefined;
  return (
    <div className="inspection">
      <div className="object-identity"><span>{row.kind}</span><strong>{row.label ?? row.id}</strong></div>
      <Field label="Status"><output>{row.status ?? '—'}</output></Field>
      <Field label="Parent"><output>{parent ? parent.id : 'top level'}</output></Field>
      <Field label="In tree"><output>{node.label}</output></Field>
      {row.badges.length > 0 && (
        <div className="token-list">{row.badges.map((badge) => <span key={badge}>◆ {badge}</span>)}</div>
      )}
      <pre className="object-json">{JSON.stringify(row, null, 2)}</pre>
    </div>
  );
}

/** Inspects the currently selected domain object. */
export function InspectPanel(props: InspectPanelProps) {
  const selection = props.selection;
  if (!selection) return <EmptySelection props={props} />;
  if (selection.kind === 'node') return <NodeInspection props={props} id={selection.id} />;
  if (selection.kind === 'interface') return <InterfaceInspection props={props} id={selection.id} />;
  if (selection.kind === 'type') return <TypeInspection props={props} id={selection.id} />;
  if (selection.kind === 'tree-row') return <TreeRowInspection props={props} nodeId={selection.nodeId} rowId={selection.rowId} />;
  return <WireInspection props={props} id={selection.id} />;
}
