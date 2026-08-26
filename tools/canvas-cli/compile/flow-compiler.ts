/** Compiles scope-level flow blocks after their referenced wires have durable identities. */

import { compileFlows, FlowError } from '../../../src/domain/flows.ts';
import type { DiagramRecord } from '../../../src/domain/records.ts';
import { slugify } from '../../../src/authoring/slug.ts';
import type { FlowAst } from '../dsl-ast.ts';
import { asId } from '../record-graph.ts';
import type { CompiledScope, CompileMessages } from './contract.ts';

function allocatedId(scope: CompiledScope, flow: FlowAst): string {
  if (flow.id) return flow.id;
  const existing = Object.values(scope.declared.record?.flows ?? {})
    .find((candidate) => slugify(candidate.name) === slugify(flow.label));
  return existing?.id as string | undefined
    ?? `${scope.diagram.rootNodeId}--flow-${slugify(flow.label)}`;
}

function validationRecord(
  scope: CompiledScope,
  flows: NonNullable<DiagramRecord['flows']>,
): DiagramRecord {
  const prior = scope.declared.record;
  const layoutId = 'layout-flow-validation';
  const viewId = 'view-flow-validation';
  return {
    ...(prior ?? {
      schemaVersion: 3 as const,
      id: asId(scope.diagram.id), name: scope.diagram.name, status: 'active' as const, revision: 0,
      nodes: {}, interfaces: {}, types: {}, layouts: {}, views: {},
      activeViewId: asId(viewId), sourceRefs: [], appliedOperations: {},
    }),
    wires: scope.diagram.wires,
    flows,
    layouts: prior?.layouts ?? { [layoutId]: {
      id: asId(layoutId), name: 'Validation', strategy: 'manual', placements: {}, wireRouteHints: {},
    } },
    views: { [viewId]: {
      id: asId(viewId), name: 'Validation',
      layoutId: prior?.views[prior.activeViewId]?.layoutId ?? asId(layoutId),
      viewport: { x: 0, y: 0, zoom: 1 }, collapsedNodeIds: [], hiddenKinds: [],
    } },
    activeViewId: asId(viewId),
  } as DiagramRecord;
}

/** Adds only validated semantic flow data to a compiled diagram. */
export function compileScopeFlows(scope: CompiledScope, messages: CompileMessages): void {
  const astById = new Map<string, FlowAst>();
  const flows: NonNullable<DiagramRecord['flows']> = {};
  for (const flow of scope.declared.scopeAst.flows) {
    const id = allocatedId(scope, flow);
    let storageKey = id;
    while (flows[storageKey]) storageKey += '-duplicate';
    astById.set(storageKey, flow);
    flows[storageKey] = {
      id: asId(id), name: flow.label,
      steps: flow.steps.map((step) => ({ ref: asId(step.ref), ordinal: step.ordinal })),
    };
  }
  try {
    const library = compileFlows(validationRecord(scope, flows));
    scope.diagram.flows = Object.fromEntries(
      [...library].map(([id, flow]) => [id, flow]),
    ) as NonNullable<DiagramRecord['flows']>;
  } catch (error) {
    if (!(error instanceof FlowError)) throw error;
    for (const item of error.issues) {
      const flowId = String(item.path[1] ?? '');
      const stepIndex = typeof item.path[3] === 'number' ? item.path[3] : undefined;
      const ast = astById.get(flowId);
      messages.errors.push({
        message: item.message,
        hint: item.path.at(-1) === 'ref'
          ? 'name a wire ID printed by ./canvas read or ./canvas flows'
          : 'use unique positive step ordinals and a unique flow id',
        line: stepIndex === undefined ? ast?.line : ast?.steps[stepIndex]?.line,
      });
    }
  }
}
