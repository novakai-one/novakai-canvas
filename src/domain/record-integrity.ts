import type { RefinementCtx } from 'zod';
import { componentFor } from '../components/registry.ts';
import { appearanceKeyForJsonKey } from './canvas-presentation.ts';
import type { DiagramRecord } from './records.ts';
import { compileTopology, TopologyError } from './topology.ts';

type Layout = DiagramRecord['layouts'][string];

function validateTopology(record: DiagramRecord, context: RefinementCtx): void {
  try {
    compileTopology(record.nodes);
  } catch (error) {
    if (!(error instanceof TopologyError)) throw error;
    context.addIssue({
      code: 'custom', message: error.message,
      path: ['nodes', error.nodeId, error.field],
      input: record.nodes[error.nodeId]?.[error.field],
    });
  }
}

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

function validateDefinitionReferences(record: DiagramRecord, context: RefinementCtx): void {
  for (const [nodeId, node] of Object.entries(record.nodes)) {
    node.interfaceIds.forEach((interfaceId, index) => {
      const item = record.interfaces[interfaceId];
      if (!item) {
        context.addIssue({
          code: 'custom', message: `node "${nodeId}" names missing interface "${interfaceId}"`,
          path: ['nodes', nodeId, 'interfaceIds', index], input: interfaceId,
        });
      } else if (item.ownerId !== nodeId) {
        context.addIssue({
          code: 'custom', message: `interface "${interfaceId}" is owned by "${item.ownerId}", not "${nodeId}"`,
          path: ['nodes', nodeId, 'interfaceIds', index], input: interfaceId,
        });
      }
    });
    node.typeIds.forEach((typeId, index) => {
      if (record.types[typeId]) return;
      context.addIssue({
        code: 'custom', message: `node "${nodeId}" names missing type "${typeId}"`,
        path: ['nodes', nodeId, 'typeIds', index], input: typeId,
      });
    });
  }
  for (const [interfaceId, item] of Object.entries(record.interfaces)) {
    const owner = record.nodes[item.ownerId];
    if (!owner) {
      context.addIssue({
        code: 'custom', message: `interface "${interfaceId}" names missing owner "${item.ownerId}"`,
        path: ['interfaces', interfaceId, 'ownerId'], input: item.ownerId,
      });
      continue;
    }
    if ((owner.interfaceIds as readonly string[]).includes(interfaceId)) continue;
    context.addIssue({
      code: 'custom', message: `owner "${item.ownerId}" does not reference interface "${interfaceId}"`,
      path: ['interfaces', interfaceId], input: interfaceId,
    });
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
  validateDefinitionReferences(record, context);
  validateWireAddresses(record, context);
  validateTopology(record, context);
  for (const [layoutId, layout] of Object.entries(record.layouts)) {
    validateWireAppearanceTargets(record, layoutId, layout, context);
    validateNodeAppearances(record, layoutId, layout, context);
    validateArrangements(record, layoutId, layout, context);
  }
}
