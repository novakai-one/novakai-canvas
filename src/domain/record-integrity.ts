import type { RefinementCtx } from 'zod';
import { componentFor } from '../components/registry.ts';
import { appearanceKeyForJsonKey } from './canvas-presentation.ts';
import type { DiagramRecord } from './records.ts';

/** Cross-field invariants that cannot be expressed by one record field's zod schema. */
export function validateRecordIntegrity(record: DiagramRecord, context: RefinementCtx): void {
  if (!record.views[record.activeViewId]) {
    context.addIssue({
      code: 'custom',
      message: `active view "${record.activeViewId}" does not exist`,
      path: ['activeViewId'],
      input: record.activeViewId,
    });
  }
  for (const [layoutId, layout] of Object.entries(record.layouts)) {
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
        if (!key || !allowed.includes(key)) {
          context.addIssue({
            code: 'custom', message: `${node.kind} does not support appearance "${jsonKey}"`,
            path: ['layouts', layoutId, 'appearanceByNodeId', nodeId, jsonKey], input: appearance,
          });
        }
      }
    }
    for (const [containerId, arrangement] of Object.entries(
      layout.arrangementByContainerId ?? {},
    )) {
      const container = record.nodes[containerId];
      if (!container || componentFor(container.kind).layoutRole !== 'container') {
        context.addIssue({
          code: 'custom', message: `arrangement target "${containerId}" is not a container`,
          path: ['layouts', layoutId, 'arrangementByContainerId', containerId], input: arrangement,
        });
        continue;
      }
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
        if (record.nodes[childId]?.parentId !== containerId) {
          context.addIssue({
            code: 'custom', message: `arranged child "${childId}" is not directly inside "${containerId}"`,
            path: ['layouts', layoutId, 'arrangementByContainerId', containerId, 'childIds', index],
            input: childId,
          });
        }
      });
    }
  }
}
