/** Writes compiled DSL into diagram records: one scope block, one record, one change set. */

import type {
  CanvasLibrary, CanvasLibraryRepository, DiagramRecord, RecordCommand,
} from '../../src/canvas.ts';
import type { CompiledDiagram } from './compile.ts';
import { contentFieldsFor } from '../../src/components/registry.ts';
import {
  asId, layoutRecord, placementsOf, type PlacedNode, type RecordNode, type RecordPlacement,
} from './record-graph.ts';

/** What applying one scope block did to its record. */
export interface ApplyOutcome {
  diagramId: string;
  name: string;
  /** `unchanged` means the DSL described exactly what was already stored; nothing was written. */
  status: 'applied' | 'duplicate' | 'unchanged';
  revision: number;
  created: boolean;
}

/** Why one scope block could not be applied. Every failure is named, none are exceptions. */
export interface ApplyFailure {
  diagramId: string;
  reason: string;
}

const PLACEHOLDER: Omit<RecordPlacement, 'nodeId'> = {
  position: { x: 0, y: 0 },
  size: { width: 1, height: 1 },
  pinned: false,
};

function depthOf(nodes: Record<string, RecordNode>, id: string): number {
  let depth = 0;
  let cursor = nodes[id]?.parentId as string | undefined;
  while (cursor && depth < 64) {
    depth += 1;
    cursor = nodes[cursor]?.parentId as string | undefined;
  }
  return depth;
}

/** Whether two nodes are the same in every way a `node.update` command cannot express. */
function structurallyEqual(left: RecordNode, right: RecordNode): boolean {
  const componentContentMatches = left.kind === right.kind
    && Object.keys(contentFieldsFor(left.kind)).every((field) =>
      JSON.stringify((left as unknown as Record<string, unknown>)[field] ?? null)
      === JSON.stringify((right as unknown as Record<string, unknown>)[field] ?? null));
  return left.kind === right.kind
    && left.parentId === right.parentId
    && JSON.stringify(left.interfaceIds) === JSON.stringify(right.interfaceIds)
    && JSON.stringify(left.typeIds) === JSON.stringify(right.typeIds)
    && componentContentMatches
    && JSON.stringify(left.subjectRef ?? null) === JSON.stringify(right.subjectRef ?? null)
    && left.expandsToDiagramId === right.expandsToDiagramId;
}

function sameWires(left: DiagramRecord['wires'], right: DiagramRecord['wires']): boolean {
  const key = (wires: DiagramRecord['wires']): string => JSON.stringify(
    Object.values(wires)
      .map((wire) => [wire.id, wire.kind, wire.label, wire.source.nodeId, wire.target.nodeId])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return key(left) === key(right);
}

/** An empty record with one default layout and one default view, before any content lands. */
export function blankRecord(id: string, name: string): DiagramRecord {
  const layoutId = 'layout-default';
  const viewId = 'view-default';
  return {
    schemaVersion: 3,
    id: asId(id),
    name,
    status: 'active',
    revision: 0,
    nodes: {},
    wires: {},
    interfaces: {},
    types: {},
    layouts: {
      [layoutId]: {
        id: asId(layoutId), name: 'Default', strategy: 'manual', placements: {}, wireRouteHints: {},
        appearanceByNodeId: {}, arrangementByContainerId: {},
      },
    },
    views: {
      [viewId]: {
        id: asId(viewId),
        name: 'Default',
        layoutId: asId(layoutId),
        viewport: { x: 0, y: 0, zoom: 1 },
        collapsedNodeIds: [],
        hiddenKinds: [],
      },
    },
    activeViewId: asId(viewId),
    sourceRefs: [],
    appliedOperations: {},
  };
}

/**
 * Builds the record the DSL describes, laid out, without touching what is stored.
 *
 * Layout runs here rather than after the change set, because a node's final geometry has to be
 * known before the command that adds it is written: geometry travels with `node.add`, and a
 * second change set to move everything afterwards would split one apply into two revisions.
 */
export function recordForCompiled(before: DiagramRecord, compiled: CompiledDiagram): DiagramRecord {
  const layoutId = before.views[before.activeViewId].layoutId as string;
  const existing = placementsOf(before);
  const placements = Object.fromEntries(Object.keys(compiled.nodes).map((nodeId) => [nodeId, {
    nodeId: asId(nodeId),
    ...structuredClone(existing[nodeId] ? {
      position: existing[nodeId].position,
      size: existing[nodeId].size,
      pinned: existing[nodeId].pinned,
    } : PLACEHOLDER),
  }])) as Record<string, RecordPlacement>;

  return layoutRecord({
    ...before,
    name: compiled.name,
    nodes: compiled.nodes,
    wires: compiled.wires,
    interfaces: compiled.interfaces,
    types: compiled.types,
    layouts: {
      ...before.layouts,
      [layoutId]: {
        ...before.layouts[layoutId],
        placements,
        wireRouteHints: Object.fromEntries(Object.entries(before.layouts[layoutId].wireRouteHints)
          .filter(([wireId]) => compiled.wires[wireId])),
        appearanceByNodeId: structuredClone(compiled.appearanceByNodeId),
        arrangementByContainerId: structuredClone(compiled.arrangementByContainerId),
      },
    },
  });
}

/**
 * Expresses the difference between what is stored and what the DSL declares as one batch.
 *
 * A node whose meaning is unchanged produces no command at all — that is what keeps its id, its
 * position and its pinned flag across a re-apply. A node the command vocabulary cannot patch in
 * place (its kind, parent, methods, types or rows changed) is removed and re-added under the
 * same id, which is why removals run deepest-first and additions parent-first.
 */
function commandsFor(before: DiagramRecord, target: DiagramRecord): RecordCommand[] {
  const placements = placementsOf(target);
  const previous = placementsOf(before);
  const commands: RecordCommand[] = [];

  const removedIds = Object.keys(before.nodes).filter((id) => !target.nodes[id]);
  const addedIds = Object.keys(target.nodes).filter((id) => !before.nodes[id]);
  const survivingIds = Object.keys(target.nodes).filter((id) => before.nodes[id]);
  const rebuiltIds = survivingIds.filter((id) => !structurallyEqual(before.nodes[id], target.nodes[id]));

  const rebuildWires = removedIds.length > 0 || addedIds.length > 0 || rebuiltIds.length > 0
    || !sameWires(before.wires, target.wires);

  if (before.name !== target.name) commands.push({ kind: 'diagram.rename', name: target.name });

  if (rebuildWires) {
    for (const wire of Object.values(before.wires)) commands.push({ kind: 'wire.remove', id: wire.id as string });
  }

  for (const id of [...removedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(before.nodes, b) - depthOf(before.nodes, a))) {
    commands.push({ kind: 'node.remove', id });
  }

  for (const id of [...addedIds, ...rebuiltIds]
    .sort((a, b) => depthOf(target.nodes, a) - depthOf(target.nodes, b))) {
    const placement = placements[id] ?? { ...PLACEHOLDER, nodeId: asId(id) };
    commands.push({
      kind: 'node.add',
      node: target.nodes[id],
      placement: { position: placement.position, size: placement.size },
    });
  }

  const rebuilt = new Set(rebuiltIds);
  for (const id of survivingIds) {
    if (rebuilt.has(id)) continue;
    const from = before.nodes[id];
    const to = target.nodes[id];
    if (from.label !== to.label || from.description !== to.description) {
      commands.push({ kind: 'node.update', id, patch: { label: to.label, description: to.description } });
    }
    const now = placements[id];
    const was = previous[id];
    if (now && was) {
      if (now.position.x !== was.position.x || now.position.y !== was.position.y) {
        commands.push({ kind: 'node.move', id, position: now.position });
      }
      if (now.size.width !== was.size.width || now.size.height !== was.size.height) {
        commands.push({ kind: 'node.resize', id, size: now.size });
      }
    }
  }

  if (rebuildWires) {
    for (const wire of Object.values(target.wires)) commands.push({ kind: 'wire.add', wire });
  }
  const beforeLayout = before.layouts[before.views[before.activeViewId].layoutId];
  const targetLayout = target.layouts[target.views[target.activeViewId].layoutId];
  const beforePresentation = {
    appearanceByNodeId: beforeLayout.appearanceByNodeId ?? {},
    arrangementByContainerId: beforeLayout.arrangementByContainerId ?? {},
  };
  const targetPresentation = {
    appearanceByNodeId: targetLayout.appearanceByNodeId ?? {},
    arrangementByContainerId: targetLayout.arrangementByContainerId ?? {},
  };
  if (JSON.stringify(beforePresentation) !== JSON.stringify(targetPresentation)) {
    commands.push({ kind: 'layout.presentation.replace', ...targetPresentation });
  }
  return commands;
}

/** Everything applying a scope block needs: the library for identity, the repository for content. */
export interface ApplyContext {
  library: CanvasLibrary;
  repository: CanvasLibraryRepository;
  operationId: string;
  timestamp: string;
}

/**
 * Applies one compiled scope block to its record as a single change set.
 *
 * The workspace remains the authority for revision, authorship and idempotency; the write that
 * follows carries its snapshot verbatim, plus methods and types: those objects remain the only
 * dictionaries outside the command vocabulary. Layout presentation travels exclusively through
 * `layout.presentation.replace` and therefore participates in the same atomic revision.
 */
export async function applyCompiledDiagram(
  context: ApplyContext,
  compiled: CompiledDiagram,
): Promise<ApplyOutcome | ApplyFailure> {
  const { library, repository } = context;
  let created = false;
  if (!library.index().entries[compiled.id]) {
    const outcome = await library.create(compiled.name, compiled.id);
    if (!('nodeLabels' in outcome)) {
      return { diagramId: compiled.id, reason: `could not create: ${outcome.status}` };
    }
    created = true;
  }

  const workspace = await library.open(compiled.id);
  if (!('snapshot' in workspace)) {
    return { diagramId: compiled.id, reason: `could not open: ${workspace.status}` };
  }

  const before = workspace.snapshot();
  const target = recordForCompiled(before, compiled);
  const commands = commandsFor(before, target);
  if (commands.length === 0) {
    return {
      diagramId: compiled.id, name: compiled.name, status: 'unchanged', revision: before.revision, created,
    };
  }

  const outcome = workspace.submit({
    operationId: context.operationId,
    expectedRevision: before.revision,
    timestamp: context.timestamp,
    commands,
  });
  if (outcome.status === 'rejected') {
    return { diagramId: compiled.id, reason: `${outcome.reason} (command ${outcome.commandIndex ?? '?'})` };
  }
  if (outcome.status === 'conflict') {
    return { diagramId: compiled.id, reason: `revision conflict: expected ${outcome.expectedRevision}, found ${outcome.actualRevision}` };
  }
  if (outcome.status === 'duplicate') {
    return {
      diagramId: compiled.id, name: compiled.name, status: 'duplicate', revision: outcome.revision, created,
    };
  }

  const written = await repository.writeDiagram({
    ...workspace.snapshot(),
    interfaces: compiled.interfaces,
    types: compiled.types,
  }, before.revision);
  if (written.status !== 'written') {
    return { diagramId: compiled.id, reason: `save ${written.status}` };
  }
  return {
    diagramId: compiled.id, name: compiled.name, status: 'applied', revision: written.revision, created,
  };
}

/** Removes one node and everything under it from an open record, as a single change set. */
export function removalCommandsFor(record: DiagramRecord, targetId: string): RecordCommand[] {
  const doomed = new Set<string>([targetId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(record.nodes)) {
      const parentId = node.parentId as string | undefined;
      if (parentId && doomed.has(parentId) && !doomed.has(node.id as string)) {
        doomed.add(node.id as string);
        changed = true;
      }
    }
  }
  // Removing a zone cascades its whole descendant closure (ruling R4), deepest first so no
  // node is ever left naming a parent that has already gone.
  return [...doomed]
    .sort((a, b) => depthOf(record.nodes, b) - depthOf(record.nodes, a))
    .map((id) => ({ kind: 'node.remove', id } as const));
}

/** Finds a node in a record by its label, the only name the DSL and the CLI ever use. */
export function findNodeByLabel(
  nodes: Record<string, PlacedNode> | Record<string, RecordNode>,
  matches: (label: string) => boolean,
): RecordNode | undefined {
  return Object.values(nodes).find((node) => matches(node.label));
}
