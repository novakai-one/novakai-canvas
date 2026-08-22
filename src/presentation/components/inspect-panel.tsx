import type { InspectPanelProps, Inspection } from './inspection/contract';
import {
  componentItemInspection, interfaceInspection, typeInspection,
} from './inspection/detail-inspections';
import { nodeInspection } from './inspection/node-inspection';
import { inspectionSupport } from './inspection/support';
import { wireInspection } from './inspection/wire-inspection';

export type { InspectPanelProps, Inspection } from './inspection/contract';

/** Describes the current selection through one small dispatcher. */
export function describeSelection(props: InspectPanelProps): Inspection {
  const selection = props.selection;
  if (!selection) return inspectionSupport.diagramInspection(props);
  if (selection.kind === 'node') return nodeInspection(props, selection.id);
  if (selection.kind === 'interface') return interfaceInspection(props, selection.id);
  if (selection.kind === 'type') return typeInspection(props, selection.id);
  if (selection.kind === 'component-item') {
    return componentItemInspection(props, selection.nodeId, selection.collection, selection.itemId);
  }
  return wireInspection(props, selection.id);
}
