import type { FlowId } from '../../contract/brands.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';
import type { NodeKind } from '../../contract/types/node-kind.ts';
import type { ProjectedView } from './project-view.ts';

/** Repo-owned rendering presets. The record never stores one; hosts hold the choice. */
export type ViewTypeId = 'full' | 'entities' | 'modules' | 'flow';

/** Dropdown order and labels for every shipped view type. */
export const VIEW_TYPES: readonly { id: ViewTypeId; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'entities', label: 'Entities' },
  { id: 'modules', label: 'Modules' },
  { id: 'flow', label: 'Active flow only' },
];

const KEPT_KINDS: Partial<Record<ViewTypeId, readonly NodeKind[]>> = {
  entities: ['entity', 'ooux-object'],
  modules: ['module', 'runtime', 'resource'],
};

function withAncestors(record: DiagramRecord, kept: Set<string>): Set<string> {
  for (const id of [...kept]) {
    const seen = new Set<string>([id]);
    let cursor = record.nodes[id]?.parentId as string | undefined;
    while (cursor && !seen.has(cursor)) {
      kept.add(cursor);
      seen.add(cursor);
      cursor = record.nodes[cursor]?.parentId as string | undefined;
    }
  }
  return kept;
}

function flowWireIds(record: DiagramRecord, activeFlowId: FlowId | undefined): Set<string> {
  const flow = activeFlowId ? record.flows?.[activeFlowId] : undefined;
  return new Set((flow?.steps ?? []).map((step) => step.ref as string));
}

/**
 * View types with something to show for this diagram; hosts disable the rest.
 * `flow` needs an active flow because it filters to that flow's steps.
 */
export function availableViewTypes(
  record: DiagramRecord,
  activeFlowId: FlowId | undefined,
): ReadonlySet<ViewTypeId> {
  const available = new Set<ViewTypeId>(['full']);
  const kinds = new Set(Object.values(record.nodes).map((node) => node.kind));
  for (const id of ['entities', 'modules'] as const) {
    if (KEPT_KINDS[id]!.some((kind) => kinds.has(kind))) available.add(id);
  }
  if (flowWireIds(record, activeFlowId).size > 0) available.add('flow');
  return available;
}

/**
 * Filters one projected view through a repo-owned preset. Pure: the record is read, never
 * written, and `full` returns the view as given. A node outside the preset hides, every wire
 * touching a hidden node hides, and kept nodes keep their ancestors so nesting still renders.
 */
export function applyViewType(
  view: ProjectedView,
  record: DiagramRecord,
  viewTypeId: ViewTypeId,
  activeFlowId: FlowId | undefined,
): ProjectedView {
  if (viewTypeId === 'full') return view;
  let keptWireIds: Set<string> | undefined;
  let kept: Set<string>;
  if (viewTypeId === 'flow') {
    keptWireIds = flowWireIds(record, activeFlowId);
    kept = new Set<string>();
    for (const wire of view.wires) {
      if (!keptWireIds.has(wire.id as string)) continue;
      kept.add(wire.source.nodeId as string);
      kept.add(wire.target.nodeId as string);
    }
  } else {
    const kinds = KEPT_KINDS[viewTypeId]!;
    kept = new Set(view.nodes
      .filter((node) => kinds.includes(node.kind))
      .map((node) => node.id as string));
  }
  withAncestors(record, kept);
  return {
    ...view,
    nodes: view.nodes.filter((node) => kept.has(node.id as string)),
    wires: view.wires.filter((wire) => (keptWireIds?.has(wire.id as string) ?? true)
      && kept.has(wire.source.nodeId as string) && kept.has(wire.target.nodeId as string)),
  };
}
