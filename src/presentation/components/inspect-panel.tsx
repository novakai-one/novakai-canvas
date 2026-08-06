import type { ReactNode } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { CanvasLayout, DiagramRecord, NodePlacement } from '../../domain/records';
import { rootGroupId, type CreatableNodeKind } from '../canvas-actions';
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
  /**
   * Making and unmaking, owned by the panel rather than by chrome floating over the canvas.
   *
   * Chris expected creation and undo in the side panels twice over — "I expected the present edit
   * add undo to be in side panels", then "surprised that there is no way to add shapes like nodes
   * and modules etc in the side panel". Creating from here also means the record of the new object
   * is already open in front of you, so making a thing and naming it are one movement.
   */
  addNode?: (kind: CreatableNodeKind) => void;
  undo?: () => void;
  canUndo?: boolean;
}

const ADDABLE: readonly CreatableNodeKind[] = ['module', 'object', 'runtime', 'resource', 'group', 'comment'];

/** Create and undo, drawn once and shown on whichever states can offer them. */
function MakingSection({ props }: { props: InspectPanelProps }) {
  const { addNode, canUndo, editable, undo } = props;
  if (!editable || !addNode) return null;
  return (
    <PanelSection title="Add to this diagram">
      <div className="add-grid">
        {ADDABLE.map((kind) => (
          <button className="panel-button" key={kind} onClick={() => addNode(kind)} type="button">
            {kind[0].toUpperCase()}{kind.slice(1)}
          </button>
        ))}
      </div>
      {undo && (
        <button className="panel-button" disabled={!canUndo} onClick={undo} type="button">
          Undo last change
        </button>
      )}
    </PanelSection>
  );
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
  /**
   * The path back to what you were looking at, innermost last.
   *
   * Chris: the studio "changes my selection without breadcrumbs". Derived from the selection
   * rather than kept as a history stack on purpose — a stack can disagree with the model after
   * an undo or a delete, whereas a path computed from what is selected right now cannot. The
   * final step is the current thing and is not drawn as a link.
   */
  trail: Array<{ label: string; select: Selection }>;
}

/** The path from the open diagram down to one node, through the groups that contain it. */
function nodeTrail(props: InspectPanelProps, id: string): Array<{ label: string; select: Selection }> {
  const rootId = rootGroupId(props.record);
  const steps: Array<{ label: string; select: Selection }> = [];
  let cursor: string | undefined = id;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const node = props.record.nodes[cursor];
    if (!node) break;
    if (cursor !== rootId) steps.unshift({ label: node.label, select: { kind: 'node', id: cursor } });
    cursor = node.parentId as string | undefined;
  }
  return [{ label: props.record.name, select: null }, ...steps];
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
    trail: [{ label: props.record.name, select: null }],
    body: (
      <>
        <MakingSection props={props} />
        {diagramContents(props)}
      </>
    ),
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
    trail: nodeTrail(props, id),
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

/**
 * Finds the type record a signature names, so a name can become the thing it refers to.
 *
 * Types are first-class records with their own ids, and the signature stores their names; the
 * panel rendered those names as dead strings and threw the join away. Matching by name is what
 * the stored signature supports today — an unmatched name simply stays text rather than
 * pretending to be a link.
 */
function typeNamed(record: DiagramRecord, name: string): { id: string } | undefined {
  const match = Object.values(record.types).find((type) => type.name === name);
  return match ? { id: match.id as string } : undefined;
}

function interfaceInspection(props: InspectPanelProps, id: string): Inspection {
  const item = props.record.interfaces[id];
  if (!item) return diagramInspection(props);
  const owner = props.record.nodes[item.ownerId];
  const signature = [
    ...item.accepts.map((name) => ({ role: 'accepts', name })),
    ...item.returns.map((name) => ({ role: 'returns', name })),
  ];
  return {
    kind: 'Interface',
    title: item.name,
    meta: `on ${owner?.label ?? item.ownerId}`,
    trail: [
      ...nodeTrail(props, item.ownerId as string),
      { label: item.name, select: { kind: 'interface', id } },
    ],
    body: (
      <>
        <PanelSection title="Signature">
          <FieldRow label="Name">
            <input
              disabled={!props.editable}
              onChange={(event) => props.execute({
                kind: 'interface.update', id, patch: { name: event.target.value },
              })}
              value={item.name}
            />
          </FieldRow>
        </PanelSection>
        <PanelSection title="Owner">
          <ul className="object-list">
            <ObjectRow
              kind={owner?.kind ?? 'missing'}
              label={owner?.label ?? item.ownerId}
              onJump={() => (props.jumpTo ?? props.select)({ kind: 'node', id: item.ownerId })}
              onPeek={() => props.select({ kind: 'node', id: item.ownerId })}
            />
          </ul>
        </PanelSection>
        <PanelSection title="Types">
          {signature.length === 0 ? (
            <FieldRow label="Signature"><output>Takes nothing, returns void</output></FieldRow>
          ) : (
            <ul className="object-list">
              {signature.map((entry, index) => {
                const type = typeNamed(props.record, entry.name);
                return type ? (
                  <ObjectRow
                    key={`${entry.role}-${entry.name}-${index}`}
                    kind={entry.role}
                    label={entry.name}
                    onJump={() => (props.jumpTo ?? props.select)({ kind: 'type', id: type.id })}
                    onPeek={() => props.select({ kind: 'type', id: type.id })}
                  />
                ) : (
                  <li className="object-row is-plain" key={`${entry.role}-${entry.name}-${index}`}>
                    <span className="object-row-kind">{entry.role}</span>
                    <span className="object-row-label">{entry.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>
      </>
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
    trail: [
      { label: props.record.name, select: null },
      { label: item.name, select: { kind: 'type', id } },
    ],
    body: (
      <PanelSection title="Shape">
        <div className="token-row">{item.fields.map((field) => <span key={field}>{field}</span>)}</div>
        <FieldRow label="Used by"><output>{usedBy.map((node) => node.label).join(', ') || 'Nothing yet'}</output></FieldRow>
      </PanelSection>
    ),
  };
}

/**
 * The relationships a wire may express, in the order the legend teaches them.
 *
 * `missing` is deliberately absent: it is a degraded state the model records when a wire has
 * lost an end, never something a person chooses.
 */
const WIRE_KINDS = ['owns', 'references', 'queries', 'executes', 'assigns', 'mentions'] as const;

function wireInspection(props: InspectPanelProps, id: string): Inspection {
  const wire = props.record.wires[id];
  if (!wire) return diagramInspection(props);
  const endpoint = (nodeId: string): { id: string; label: string; kind: string } => ({
    id: nodeId,
    label: props.record.nodes[nodeId]?.label ?? nodeId,
    kind: props.record.nodes[nodeId]?.kind ?? 'missing',
  });
  const from = endpoint(wire.source.nodeId);
  const to = endpoint(wire.target.nodeId);
  return {
    kind: 'Wire',
    title: wire.label || 'Unlabelled',
    meta: `${from.label} → ${to.label}`,
    trail: [
      { label: props.record.name, select: null },
      { label: wire.label || 'Unlabelled', select: { kind: 'wire', id } },
    ],
    body: (
      <>
        <PanelSection title="Relationship">
          {/*
            * A wire's own record is editable here, like a node's.
            * It used to be four lines of dead text over a model that has always accepted
            * `wire.update`, so the panel's grammar changed depending on what you clicked.
            */}
          <FieldRow label="Label">
            <input
              disabled={!props.editable}
              onChange={(event) => props.execute({ kind: 'wire.update', id, patch: { label: event.target.value } })}
              value={wire.label ?? ''}
            />
          </FieldRow>
          <FieldRow label="Kind">
            <select
              disabled={!props.editable}
              onChange={(event) => props.execute({
                kind: 'wire.update', id, patch: { kind: event.target.value as typeof WIRE_KINDS[number] },
              })}
              value={wire.kind}
            >
              {WIRE_KINDS.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
              {!WIRE_KINDS.includes(wire.kind as typeof WIRE_KINDS[number]) && (
                <option value={wire.kind}>{wire.kind}</option>
              )}
            </select>
          </FieldRow>
        </PanelSection>
        {/*
          * Endpoints are the objects themselves, not their names.
          * Same two acts as every other object row — peek selects, the crosshair travels — so
          * "what is this wire attached to" is answerable by clicking rather than by reading.
          */}
        <PanelSection title="Endpoints">
          <ul className="object-list">
            {[from, to].map((end, index) => (
              <ObjectRow
                key={`${end.id}-${index === 0 ? 'from' : 'to'}`}
                kind={index === 0 ? 'from' : 'to'}
                label={`${end.label}`}
                onJump={() => (props.jumpTo ?? props.select)({ kind: 'node', id: end.id })}
                onPeek={() => props.select({ kind: 'node', id: end.id })}
              />
            ))}
          </ul>
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
    trail: [
      ...nodeTrail(props, nodeId),
      { label: row.label ?? row.id, select: { kind: 'tree-row', nodeId, rowId } },
    ],
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
