import { createElement } from 'react';
import type { CanvasLayout, DiagramRecord, NodePlacement } from '../../../domain/records';
import { rootGroupId } from '../../canvas-actions';
import type { InspectPanelProps, Inspection } from './contract';

function splitTypes(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function nodeTrail(props: InspectPanelProps, id: string) {
  const rootId = rootGroupId(props.record);
  const steps: Inspection['trail'] = [];
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

function placementOf(
  record: DiagramRecord,
  nodeId: string,
): Pick<NodePlacement, 'position' | 'pinned'> {
  const placement = activeLayout(record)?.placements[nodeId];
  return { position: placement?.position ?? { x: 0, y: 0 }, pinned: placement?.pinned ?? false };
}

function sectionProps(props: InspectPanelProps, sectionId: string) {
  return { sectionId, open: props.isSectionOpen(sectionId), onToggle: props.toggleSection };
}

function typeNamed(record: DiagramRecord, name: string): { id: string } | undefined {
  const match = Object.values(record.types).find((type) => type.name === name);
  return match ? { id: match.id as string } : undefined;
}

/** Empty-selection view; also the safe fallback for stale selections. */
function diagramInspection(props: InspectPanelProps): Inspection {
  const rootId = rootGroupId(props.record);
  return {
    kind: 'Diagram', title: props.record.name, meta: '',
    rename: props.editable && rootId ? (label) => {
      const name = label.trim();
      if (!name) return;
      props.executeAll([
        { kind: 'diagram.rename', name },
        { kind: 'node.update', id: rootId, patch: { label: name } },
      ]);
    } : undefined,
    trail: [{ label: props.record.name, select: null }], sections: [],
    body: createElement('div', { className: 'panel-idle' },
      createElement('span', null, 'Select an object to inspect it.')),
  };
}

/** Cohesive read-only helpers used by inspection descriptions. */
export const inspectionSupport = {
  activeLayout, diagramInspection, nodeTrail, placementOf, sectionProps, splitTypes, typeNamed,
};
