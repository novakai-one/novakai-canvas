import type { RefinementCtx } from 'zod';
import type { DiagramRecord } from '../../contract/records/index.ts';
import { appearanceKeyForJsonKey } from '../../contract/schemas/presentation.ts';
import { componentFor } from '../components/registry.ts';

type Layout = DiagramRecord['layouts'][string];

function validateWireTargets(
  record: DiagramRecord, layoutId: string, layout: Layout, context: RefinementCtx,
): void {
  for (const [wireId, appearance] of Object.entries(layout.appearanceByWireId ?? {})) {
    if (record.wires[wireId]) continue;
    context.addIssue({
      code: 'custom', message: `appearance names missing wire "${wireId}"`,
      path: ['layouts', layoutId, 'appearanceByWireId', wireId], input: appearance,
    });
  }
}

function validateNodeTargets(
  record: DiagramRecord, layoutId: string, layout: Layout, context: RefinementCtx,
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

function validateChildren(
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

/** Validates presentation references after structural schema parsing. */
export function validatePresentationIntegrity(record: DiagramRecord, context: RefinementCtx): void {
  for (const [layoutId, layout] of Object.entries(record.layouts)) {
    validateWireTargets(record, layoutId, layout, context);
    validateNodeTargets(record, layoutId, layout, context);
    for (const [containerId, arrangement] of Object.entries(layout.arrangementByContainerId ?? {})) {
      const container = record.nodes[containerId];
      if (!container || componentFor(container.kind).layoutRole !== 'container') {
        context.addIssue({
          code: 'custom', message: `arrangement target "${containerId}" is not a container`,
          path: ['layouts', layoutId, 'arrangementByContainerId', containerId], input: arrangement,
        });
        continue;
      }
      validateChildren(record, layoutId, containerId, arrangement, context);
    }
  }
}
