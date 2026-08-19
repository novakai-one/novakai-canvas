import type { ReactNode } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import type { RecordCommand } from '../../application/canvas-workspace';
import type { Selection } from '../../domain/model';
import type { ProjectedView } from '../../domain/project-view';
import type { CanvasLayout, DiagramRecord, NodePlacement } from '../../domain/records';
import { useState } from 'react';
import { isSignatureName } from '../../application/canvas-workspace';
import { rootGroupId } from '../canvas-actions';
import { FieldRow, ObjectRow, PanelSection, SwitchRow } from '../shell';

/** Everything the inspector reads about the open diagram and the library around it. */
export interface InspectPanelProps {
  record: DiagramRecord;
  /** Only what is visible, so the contents list matches what is on screen. */
  view: ProjectedView;
  selection: Selection;
  execute: (command: RecordCommand) => void;
  /** Several commands, one undoable act — for renames and gestures that write two facts. */
  executeAll: (commands: RecordCommand[]) => void;
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
  /** Gives a node a new interface and selects it, ready to be named. */
  addInterface?: (ownerId: string) => void;
  /** Whether one section of this body is expanded. Owned by the Studio, answered per section. */
  isSectionOpen: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
}

/** Splits a typed list, dropping the empties a trailing comma leaves behind. */
function splitTypes(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * A signature field that refuses what the model cannot render.
 *
 * Chris asked that a node's body "conform to typescript or some standard so people don't write
 * random stuff". The workspace enforces that — it is a rule about the record, not about a form —
 * so this only has to say so before the keystroke is wasted: it holds a local draft, marks it
 * when it is not a valid identifier, and commits nothing until it is.
 */
function SignatureInput({
  disabled, list, onCommit, value,
}: {
  value: string;
  disabled?: boolean;
  list?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const parts = list ? splitTypes(shown) : [shown];
  const valid = shown.trim().length === 0 ? list === true : parts.every(isSignatureName);
  const commit = (): void => {
    if (draft !== null && valid && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      data-invalid={!valid || undefined}
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setDraft(null); }}
      title={valid ? undefined : 'Must be an identifier, like SessionHandle or Frame[]'}
      value={shown}
    />
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
  /**
   * Renaming, done where the name already is.
   *
   * The header showed the name and then an Identity section showed it again in a field, so the
   * first thing every selection said was its own title twice. Present means the title itself is
   * the input; absent means this selection cannot be renamed.
   */
  rename?: (label: string) => void;
  /** One destructive act, kept out of the body and behind the header's overflow. */
  remove?: { label: string; run: () => void };
  /**
   * The sections this body draws, in order.
   *
   * The Studio needs the list to run the accordion — which one is open, and which are one
   * heading row each — and only the inspection knows what it is about to draw.
   */
  sections: readonly string[];
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

/**
 * What the panel shows when nothing is selected: nothing.
 *
 * It used to backfill with a creation palette and the whole contents list, which is how the
 * Studio became a navigator without being asked to. The panel stays — closing it is the user's
 * decision, never the app's — and it stays empty, because there is genuinely nothing to inspect.
 */
function diagramInspection(props: InspectPanelProps): Inspection {
  const rootId = rootGroupId(props.record);
  return {
    kind: 'Diagram',
    title: props.record.name,
    meta: '',
    /*
     * The record owns the diagram's name and the root frame wears it on the canvas, so one
     * edit writes both — batched, because one rename is one undoable act. This is the same
     * pairing nodeInspection makes for the root node; the diagram just never had a door in.
     */
    rename: props.editable && rootId
      ? (label: string) => {
        const name = label.trim();
        if (name.length === 0) return;
        props.executeAll([
          { kind: 'diagram.rename', name },
          { kind: 'node.update', id: rootId, patch: { label: name } },
        ]);
      }
      : undefined,
    trail: [{ label: props.record.name, select: null }],
    sections: [],
    body: (
      <div className="panel-idle">
        <span>Select an object to inspect it.</span>
      </div>
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
  // The record owns its own title, and the root container shows that title on the canvas. Renaming
  // one without the other would put two different names on one diagram, so they move together.
  const rename = (label: string): void => {
    props.execute({ kind: 'node.update', id, patch: { label } });
    if (isRoot && label.trim().length > 0) props.execute({ kind: 'diagram.rename', name: label });
  };
  const section = (sectionId: string) => ({
    sectionId,
    open: props.isSectionOpen(sectionId),
    onToggle: props.toggleSection,
  });
  return {
    kind: node.kind,
    title: node.label,
    /*
     * No meta line.
     *
     * It read "in Agent Browser Sessions" directly under a trail whose last link said exactly
     * that, so the panel's first three lines were the name, the parent, and the parent again.
     * The counts it carried on the diagram — objects, wires, revision — are all things the
     * canvas itself already shows.
     */
    meta: '',
    rename: props.editable ? rename : undefined,
    remove: props.editable && !isRoot
      ? {
        label: 'Delete object',
        run: () => { props.execute({ kind: 'node.remove', id }); props.clearSelection(); },
      }
      : undefined,
    trail: nodeTrail(props, id),
    sections: ['description', 'interfaces', 'placement'],
    body: (
      <>
        <PanelSection {...section('description')} title="Description">
          <textarea
            disabled={!props.editable}
            onChange={(event) => props.execute({ kind: 'node.update', id, patch: { description: event.target.value } })}
            placeholder="What is this?"
            value={node.description ?? ''}
          />
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
        {/*
          * A node's interfaces, on the node — Chris: "adding a node doesn't allow me to add
          * interface". The count that used to sit in a Facts grid is the section's own trailing
          * number now, so the fact and the thing itself are one row instead of two places.
          */}
        <PanelSection
          {...section('interfaces')}
          title="Interfaces"
          trailing={node.interfaceIds.length > 0
            ? <span className="rail-count">{node.interfaceIds.length}</span> : undefined}
        >
          {node.interfaceIds.length === 0
            ? <div className="panel-empty"><span>None yet</span></div>
            : (
              <ul className="object-list">
                {node.interfaceIds.map((interfaceId) => {
                  const item = props.record.interfaces[interfaceId];
                  return item ? (
                    <ObjectRow
                      key={interfaceId}
                      kind="interface"
                      label={`${item.name}(${item.accepts.join(', ')})`}
                      onJump={() => props.select({ kind: 'interface', id: interfaceId })}
                      onPeek={() => props.select({ kind: 'interface', id: interfaceId })}
                    />
                  ) : null;
                })}
              </ul>
            )}
          {props.editable && props.addInterface && (
            <button className="panel-button" onClick={() => props.addInterface?.(id)} type="button">
              + Add interface
            </button>
          )}
        </PanelSection>
        <PanelSection {...section('placement')} title="Placement">
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

/** The accordion props one section needs, so every inspection wires them the same way. */
function sectionProps(props: InspectPanelProps, sectionId: string) {
  return { sectionId, open: props.isSectionOpen(sectionId), onToggle: props.toggleSection };
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
    meta: '',
    remove: props.editable
      ? {
        label: 'Delete interface',
        run: () => {
          props.execute({ kind: 'interface.remove', id });
          props.select({ kind: 'node', id: item.ownerId });
        },
      }
      : undefined,
    sections: ['signature', 'owner', 'types'],
    trail: [
      ...nodeTrail(props, item.ownerId as string),
      { label: item.name, select: { kind: 'interface', id } },
    ],
    body: (
      <>
        <PanelSection {...sectionProps(props, 'signature')} title="Signature">
          <FieldRow hint="identifier" label="Name">
            <SignatureInput
              disabled={!props.editable}
              onCommit={(next) => props.execute({
                kind: 'interface.update', id, patch: { name: next },
              })}
              value={item.name}
            />
          </FieldRow>
          <FieldRow hint="comma separated types" label="Accepts">
            <SignatureInput
              disabled={!props.editable}
              list
              onCommit={(next) => props.execute({
                kind: 'interface.update', id, patch: { accepts: splitTypes(next) },
              })}
              value={item.accepts.join(', ')}
            />
          </FieldRow>
          <FieldRow hint="comma separated types" label="Returns">
            <SignatureInput
              disabled={!props.editable}
              list
              onCommit={(next) => props.execute({
                kind: 'interface.update', id, patch: { returns: splitTypes(next) },
              })}
              value={item.returns.join(', ')}
            />
          </FieldRow>
        </PanelSection>
        <PanelSection {...sectionProps(props, 'owner')} title="Owner">
          <ul className="object-list">
            <ObjectRow
              kind={owner?.kind ?? 'missing'}
              label={owner?.label ?? item.ownerId}
              onJump={() => (props.jumpTo ?? props.select)({ kind: 'node', id: item.ownerId })}
              onPeek={() => props.select({ kind: 'node', id: item.ownerId })}
            />
          </ul>
        </PanelSection>
        <PanelSection {...sectionProps(props, 'types')} title="Types">
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
    meta: '',
    sections: ['shape'],
    trail: [
      { label: props.record.name, select: null },
      { label: item.name, select: { kind: 'type', id } },
    ],
    body: (
      <PanelSection {...sectionProps(props, 'shape')} title="Shape">
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
    meta: '',
    remove: props.editable
      ? {
        label: 'Delete wire',
        run: () => { props.execute({ kind: 'wire.remove', id }); props.clearSelection(); },
      }
      : undefined,
    sections: ['relationship', 'endpoints', 'routing'],
    trail: [
      { label: props.record.name, select: null },
      { label: wire.label || 'Unlabelled', select: { kind: 'wire', id } },
    ],
    body: (
      <>
        <PanelSection {...sectionProps(props, 'relationship')} title="Relationship">
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
        <PanelSection {...sectionProps(props, 'endpoints')} title="Endpoints">
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
        <PanelSection {...sectionProps(props, 'routing')} title="Routing">
          <FieldRow label="Path"><output>Elbow</output></FieldRow>
        </PanelSection>
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
    meta: '',
    sections: ['row'],
    trail: [
      ...nodeTrail(props, nodeId),
      { label: row.label ?? row.id, select: { kind: 'tree-row', nodeId, rowId } },
    ],
    body: (
      <PanelSection {...sectionProps(props, 'row')} title="Row">
        <FieldRow label="Status"><output>{row.status ?? '—'}</output></FieldRow>
        <FieldRow label="Parent"><output>{parent ? parent.id : 'top level'}</output></FieldRow>
        {row.badges.length > 0 && (
          <div className="token-row">{row.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
        )}
      </PanelSection>
    ),
  };
}

function timelineStepInspection(props: InspectPanelProps, nodeId: string, stepId: string): Inspection {
  const node = props.record.nodes[nodeId];
  const step = node?.steps?.find((item) => item.id === stepId);
  if (!node || !step) return diagramInspection(props);
  return {
    kind: 'timeline step',
    title: step.label,
    meta: '',
    sections: ['step'],
    trail: [
      ...nodeTrail(props, nodeId),
      { label: step.label, select: { kind: 'timeline-step', nodeId, stepId } },
    ],
    body: (
      <PanelSection {...sectionProps(props, 'step')} title="Step">
        <FieldRow label="ID"><output>{step.id}</output></FieldRow>
        <FieldRow label="Label"><output>{step.label}</output></FieldRow>
        <FieldRow label="Fork"><output>{step.fork ?? '—'}</output></FieldRow>
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
  if (selection.kind === 'timeline-step') {
    return timelineStepInspection(props, selection.nodeId, selection.stepId);
  }
  return wireInspection(props, selection.id);
}
