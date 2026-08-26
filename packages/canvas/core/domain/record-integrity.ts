import type { RefinementCtx } from 'zod';
import { componentFor } from '../components/registry.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';
import { compileTopology, TopologyError } from './topology.ts';
import { compileFlows, FlowError } from './flows.ts';
import { validatePresentationIntegrity } from './record-integrity-presentation.ts';

function validateTopology(record: DiagramRecord, context: RefinementCtx): void {
  try {
    compileTopology(record);
  } catch (error) {
    if (!(error instanceof TopologyError)) throw error;
    context.addIssue({
      code: 'custom', message: error.message,
      path: [...error.path],
      input: error.input ?? (error.field === 'anchor'
        ? undefined : record.nodes[error.nodeId]?.[error.field]),
    });
  }
}

function validateFlows(record: DiagramRecord, context: RefinementCtx): void {
  try {
    compileFlows(record);
  } catch (error) {
    if (!(error instanceof FlowError)) throw error;
    for (const item of error.issues) {
      context.addIssue({ code: 'custom', message: item.message, path: [...item.path], input: item.input });
    }
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
  validateFlows(record, context);
  validatePresentationIntegrity(record, context);
}
