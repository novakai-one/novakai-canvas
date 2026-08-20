import { componentFor } from '../../components/registry.ts';
import {
  appearanceKeyForJsonKey, layoutPresentationSchema,
} from '../../domain/canvas-presentation.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import { directChildIds } from './arrangement.ts';
import type { RecordCommand } from './contract.ts';

type PresentationCommand = Extract<RecordCommand, { kind: 'layout.presentation.replace' }>;

function requireNode(record: DiagramRecord, id: string): void {
  if (!record.nodes[id]) throw new Error(`node-not-found:${id}`);
}

function validateAppearance(record: DiagramRecord, appearanceByNodeId: Record<string, object>): void {
  for (const [nodeId, appearance] of Object.entries(appearanceByNodeId)) {
    requireNode(record, nodeId);
    const allowed = componentFor(record.nodes[nodeId].kind).appearanceKeys ?? [];
    for (const jsonKey of Object.keys(appearance)) {
      const key = appearanceKeyForJsonKey(jsonKey);
      if (!key || !allowed.includes(key)) {
        throw new Error(`appearance-not-supported:${nodeId}:${jsonKey}`);
      }
    }
  }
}

function validateArrangements(
  record: DiagramRecord,
  arrangements: PresentationCommand['arrangementByContainerId'],
): void {
  for (const [containerId, arrangement] of Object.entries(arrangements)) {
    requireNode(record, containerId);
    const component = componentFor(record.nodes[containerId].kind);
    if (component.layoutRole !== 'container') {
      throw new Error(`arrangement-target-not-container:${containerId}`);
    }
    if (!component.arrangementModes?.includes(arrangement.layout)) {
      throw new Error(`arrangement-mode-not-supported:${containerId}:${arrangement.layout}`);
    }
    const childIds = directChildIds(record, containerId);
    const directChildren = new Set(childIds);
    for (const childId of arrangement.childIds) {
      if (!directChildren.has(childId)) {
        throw new Error(`arrangement-child-not-direct:${containerId}:${childId}`);
      }
    }
    if (arrangement.childIds.length !== childIds.length) {
      throw new Error(`arrangement-must-name-every-direct-child:${containerId}`);
    }
  }
}

/** Validates the complete presentation replacement against its record. */
export function validatePresentation(record: DiagramRecord, command: PresentationCommand): void {
  layoutPresentationSchema.parse({
    appearanceByNodeId: command.appearanceByNodeId,
    appearanceByWireId: command.appearanceByWireId,
    arrangementByContainerId: command.arrangementByContainerId,
  });
  for (const wireId of Object.keys(command.appearanceByWireId)) {
    if (!record.wires[wireId]) throw new Error(`appearance-wire-not-found:${wireId}`);
  }
  validateAppearance(record, command.appearanceByNodeId);
  validateArrangements(record, command.arrangementByContainerId);
}
