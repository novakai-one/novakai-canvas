import type { RefinementCtx } from 'zod';
import { componentFor } from '../components/registry.ts';
import { appearanceKeyForJsonKey } from './canvas-presentation.ts';
import type { DiagramRecord } from './records.ts';

type Layout = DiagramRecord['layouts'][string];

function validateWireAddresses(record: DiagramRecord, context: RefinementCtx): void {
  const wireAddresses = new Map<string, string>();
  for (const [nodeId, node] of Object.entries(record.nodes)) {
    const address = componentFor(node.kind).identity?.wireAddress;
    if (typeof address !== 'object') continue;
    const value = node[address.field];
    if (typeof value !== 'string' || value.length === 0) continue;
    const previous = wireAddresses.get(value);
    if (previous) {
      context.addIssue({
        code: 'custom', message: `wire address "${value}" is duplicated by "${previous}" and "${nodeId}"`,
        path: ['nodes', nodeId, address.field], input: value,
      });
    } else wireAddresses.set(value, nodeId);
  }
}

function validateWireAppearanceTargets(
  record: DiagramRecord,
  layoutId: string,
  layout: Layout,
  context: RefinementCtx,
): void {
  for (const [wireId, appearance] of Object.entries(layout.appearanceByWireId ?? {})) {
    if (record.wires[wireId]) continue;
    context.addIssue({
      code: 'custom', message: `appearance names missing wire "${wireId}"`,
      path: ['layouts', layoutId, 'appearanceByWireId', wireId], input: appearance,
    });
  }
}

function validateNodeAppearances(
  record: DiagramRecord,
  layoutId: string,
  layout: Layout,
  context: RefinementCtx,
): void {
  for (const [nodeId, appearance] of Object.entries(layout.appearanceByNodeId ?? {})) {
    const node = record.nodes[nodeId];
    if (!node) {
      context.addIssue({
        code: 'custom', message: `appearance names missing node "${nodeId}"`,
        path: ['layouts', layoutId, 'appearanceByNodeId', nodeId], input: appearance,
      });
      continue;
    }
    const allowed = componentFor(node.kind).appearanceKeys ?? [];
    for (const jsonKey of Object.keys(appearance)) {
      const key = appearanceKeyForJsonKey(jsonKey);
      if (key && allowed.includes(key)) continue;
      context.addIssue({
        code: 'custom', message: `${node.kind} does not support appearance "${jsonKey}"`,
        path: ['layouts', layoutId, 'appearanceByNodeId', nodeId, jsonKey], input: appearance,
      });
    }
  }
}

function validateArrangementChildren(
  record: DiagramRecord,
  layoutId: string,
  containerId: string,
  arrangement: NonNullable<Layout['arrangementByContainerId']>[string],
  context: RefinementCtx,
): void {
  const directChildIds = Object.values(record.nodes)
    .filter((node) => node.parentId === containerId)
    .map((node) => node.id as string);
  const arrangedChildIds = new Set(arrangement.childIds);
  if (arrangement.childIds.length !== directChildIds.length
    || arrangedChildIds.size !== directChildIds.length
    || directChildIds.some((childId) => !arrangedChildIds.has(childId))) {
    context.addIssue({
      code: 'custom', message: `arrangement for "${containerId}" must name every direct child exactly once`,
      path: ['layouts', layoutId, 'arrangementByContainerId', containerId, 'childIds'],
      input: arrangement.childIds,
    });
  }
  arrangement.childIds.forEach((childId, index) => {
    if (record.nodes[childId]?.parentId === containerId) return;
    context.addIssue({
      code: 'custom', message: `arranged child "${childId}" is not directly inside "${containerId}"`,
      path: ['layouts', layoutId, 'arrangementByContainerId', containerId, 'childIds', index],
      input: childId,
    });
  });
}

function validateArrangements(
  record: DiagramRecord,
  layoutId: string,
  layout: Layout,
  context: RefinementCtx,
): void {
  for (const [containerId, arrangement] of Object.entries(layout.arrangementByContainerId ?? {})) {
    const container = record.nodes[containerId];
    if (!container || componentFor(container.kind).layoutRole !== 'container') {
      context.addIssue({
        code: 'custom', message: `arrangement target "${containerId}" is not a container`,
        path: ['layouts', layoutId, 'arrangementByContainerId', containerId], input: arrangement,
      });
      continue;
    }
    validateArrangementChildren(record, layoutId, containerId, arrangement, context);
  }
}

/** Cross-field invariants that cannot be expressed by one record field's zod schema. */
export function validateRecordIntegrity(record: DiagramRecord, context: RefinementCtx): void {
  if (!record.views[record.activeViewId]) {
    context.addIssue({
      code: 'custom', message: `active view "${record.activeViewId}" does not exist`,
      path: ['activeViewId'], input: record.activeViewId,
    });
  }
  validateWireAddresses(record, context);
  for (const [layoutId, layout] of Object.entries(record.layouts)) {
    validateWireAppearanceTargets(record, layoutId, layout, context);
    validateNodeAppearances(record, layoutId, layout, context);
    validateArrangements(record, layoutId, layout, context);
  }
}
