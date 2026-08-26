/** Pure compilation and presentation-independent queries for named wire flows. */

import type { FlowId, NodeId, WireId } from '../../contract/brands.ts';
import type { DiagramRecord, Flow, FlowStep } from '../../contract/records/index.ts';

export type Emphasis = 'focal' | 'context' | 'muted';
export interface CompiledFlow extends Omit<Flow, 'steps'> {
  readonly id: FlowId;
  readonly name: string;
  readonly steps: readonly Readonly<FlowStep>[];
}
export type FlowLibrary = ReadonlyMap<FlowId, CompiledFlow>;

export interface FlowIssue {
  message: string;
  path: readonly (string | number)[];
  input: unknown;
}

/** Stable relative weight for non-CSS hosts: muted 0, context 1, focal 2. */
export function emphasisLevel(emphasis: Emphasis): 0 | 1 | 2 {
  if (emphasis === 'focal') return 2;
  return emphasis === 'context' ? 1 : 0;
}

/** Every invalid flow fact from one compile, so adapters can report them in one pass. */
export class FlowError extends Error {
  readonly issues: readonly FlowIssue[];

  constructor(issues: readonly FlowIssue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'FlowError';
    this.issues = issues;
  }
}

interface Endpoints { source: NodeId; target: NodeId }

class CompiledFlowLibrary implements ReadonlyMap<FlowId, CompiledFlow> {
  readonly #flows: ReadonlyMap<FlowId, CompiledFlow>;
  readonly #endpoints: ReadonlyMap<WireId, Endpoints>;

  constructor(flows: Map<FlowId, CompiledFlow>, endpoints: Map<WireId, Endpoints>) {
    this.#flows = flows;
    this.#endpoints = endpoints;
  }

  get size(): number { return this.#flows.size; }
  get(id: FlowId): CompiledFlow | undefined { return this.#flows.get(id); }
  has(id: FlowId): boolean { return this.#flows.has(id); }
  endpointsOf(id: WireId): Endpoints | undefined { return this.#endpoints.get(id); }
  entries(): MapIterator<[FlowId, CompiledFlow]> { return this.#flows.entries(); }
  keys(): MapIterator<FlowId> { return this.#flows.keys(); }
  values(): MapIterator<CompiledFlow> { return this.#flows.values(); }
  forEach(
    callback: (value: CompiledFlow, key: FlowId, map: FlowLibrary) => void,
    thisArg?: unknown,
  ): void {
    this.#flows.forEach((value, key) => callback.call(thisArg, value, key, this));
  }
  [Symbol.iterator](): MapIterator<[FlowId, CompiledFlow]> { return this.entries(); }
  get [Symbol.toStringTag](): string { return 'FlowLibrary'; }
}

/** Canonical step order, independent of declaration order. */
export function stepsOf(flow: Pick<Flow, 'steps'> | CompiledFlow): readonly Readonly<FlowStep>[] {
  return [...flow.steps].sort((left, right) => left.ordinal - right.ordinal);
}

function issue(
  issues: FlowIssue[], message: string, path: readonly (string | number)[], input: unknown,
): void {
  issues.push({ message, path, input });
}

/** Compiles every flow and rejects all bad joins before any host sees the record. */
export function compileFlows(record: DiagramRecord): FlowLibrary {
  const issues: FlowIssue[] = [];
  const flows = new Map<FlowId, CompiledFlow>();
  const seenIds = new Map<string, string>();
  for (const [key, declared] of Object.entries(record.flows ?? {})
    .sort(([left], [right]) => left.localeCompare(right))) {
    const path = ['flows', key] as const;
    if (key !== declared.id) {
      issue(issues, `flow key "${key}" does not match id "${declared.id}"`, [...path, 'id'], declared.id);
    }
    const previous = seenIds.get(declared.id as string);
    if (previous) {
      issue(issues, `flow id "${declared.id}" is duplicated by "${previous}" and "${key}"`, [...path, 'id'], declared.id);
    } else seenIds.set(declared.id as string, key);
    const ordinals = new Set<number>();
    declared.steps.forEach((step, index) => {
      const stepPath = [...path, 'steps', index] as const;
      if (step.ordinal <= 0) {
        issue(issues, `flow "${declared.name}" step ordinal ${step.ordinal} must be positive`, [...stepPath, 'ordinal'], step.ordinal);
      }
      if (ordinals.has(step.ordinal)) {
        issue(issues, `flow "${declared.name}" repeats step ordinal ${step.ordinal}; use unique positive integers`, [...stepPath, 'ordinal'], step.ordinal);
      }
      ordinals.add(step.ordinal);
      if (!record.wires[step.ref]) {
        const available = Object.keys(record.wires).sort().join(', ') || 'none';
        issue(issues, `flow "${declared.name}" step ${step.ordinal} names missing wire "${step.ref}"; available wires: ${available}`, [...stepPath, 'ref'], step.ref);
      }
    });
    const canonical = Object.freeze({
      ...declared,
      steps: Object.freeze(stepsOf(declared).map((step) => Object.freeze({ ...step }))),
    }) as CompiledFlow;
    flows.set(declared.id, canonical);
  }
  const layoutIds = new Set(Object.values(record.views).map((view) => view.layoutId as string));
  if (layoutIds.size > 1) {
    issue(issues, 'every view of a diagram must share one layoutId', ['views'], [...layoutIds].sort());
  }
  for (const [viewId, view] of Object.entries(record.views)) {
    if (view.flowId === undefined || flows.has(view.flowId)) continue;
    issue(issues, `view "${viewId}" names missing flow "${view.flowId}"; choose a declared flow or clear it`, ['views', viewId, 'flowId'], view.flowId);
  }
  if (issues.length) throw new FlowError(issues);
  const endpoints = new Map(Object.values(record.wires).map((wire) => [wire.id, {
    source: wire.source.nodeId, target: wire.target.nodeId,
  }]));
  return new CompiledFlowLibrary(flows, endpoints);
}

/** Derives every wire's visual role without storing or performing host work. */
export function wireEmphasis(
  library: FlowLibrary,
  activeFlowId: FlowId | undefined,
  wireIds: readonly WireId[],
): Record<string, Emphasis> {
  const result: Record<string, Emphasis> = {};
  if (activeFlowId === undefined) {
    for (const wireId of wireIds) result[wireId] = 'context';
    return result;
  }
  const active = library.get(activeFlowId);
  if (!active) throw new RangeError(`unknown flow "${activeFlowId}"`);
  const focal = new Set(stepsOf(active).map((step) => step.ref as string));
  const endpointOf = (id: WireId) => library instanceof CompiledFlowLibrary
    ? library.endpointsOf(id) : undefined;
  const focalNodes = new Set<string>();
  for (const wireId of focal) {
    const pair = endpointOf(wireId as WireId);
    if (pair) focalNodes.add(pair.source as string).add(pair.target as string);
  }
  for (const wireId of wireIds) {
    const pair = endpointOf(wireId);
    result[wireId] = focal.has(wireId as string) ? 'focal'
      : pair && (focalNodes.has(pair.source as string) || focalNodes.has(pair.target as string))
        ? 'context' : 'muted';
  }
  return result;
}
