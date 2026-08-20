import type { DiagramRecord, PortSide, WireRouteHint } from '../domain/records.ts';
import type { CanvasActor, CanvasProvenance } from '../domain/model.ts';
import { componentFor } from '../components/registry.ts';
import {
  appearanceKeyForJsonKey, layoutPresentationSchema,
  type ContainerArrangement, type NodeAppearance,
} from '../domain/canvas-presentation.ts';

/** Who is acting and through which surface. Supplied by the host, never by a caller payload. */
export interface ActorContext {
  actor: CanvasActor;
  provenance: CanvasProvenance;
}

/** A batch of intentions applied as one revision, or not at all. */
export interface RecordChangeSet {
  operationId: string;
  expectedRevision: number;
  timestamp: string;
  commands: RecordCommand[];
}

/** Every mutation the capability accepts. Hosts compose these; they never edit records. */
export type RecordCommand =
  | { kind: 'node.add'; node: DiagramRecord['nodes'][string]; placement: PlacementInput }
  | { kind: 'node.move'; id: string; position: { x: number; y: number } }
  | { kind: 'node.resize'; id: string; size: { width: number; height: number } }
  | { kind: 'node.pin'; id: string; pinned: boolean }
  | { kind: 'node.update'; id: string; patch: { label?: string; description?: string } }
  | { kind: 'node.reparent'; id: string; parentId?: string }
  | { kind: 'node.remove'; id: string }
  | { kind: 'wire.add'; wire: DiagramRecord['wires'][string] }
  | { kind: 'wire.reconnect'; id: string; source?: string; target?: string }
  | { kind: 'wire.setRoute'; id: string; route: RouteInput }
  /** A wire's own words. Its ends move through `wire.reconnect`, which has its own rules. */
  | {
    kind: 'wire.update';
    id: string;
    patch: { label?: string; kind?: DiagramRecord['wires'][string]['kind'] };
  }
  | { kind: 'wire.remove'; id: string }
  | { kind: 'interface.add'; ownerId: string; iface: DiagramRecord['interfaces'][string] }
  | {
    kind: 'interface.update';
    id: string;
    patch: { name?: string; accepts?: string[]; returns?: string[] };
  }
  | { kind: 'interface.remove'; id: string }
  | { kind: 'view.setCollapsed'; id: string; collapsed: boolean }
  | { kind: 'view.setViewport'; viewport: { x: number; y: number; zoom: number } }
  | {
    kind: 'layout.presentation.replace';
    appearanceByNodeId: Record<string, NodeAppearance>;
    arrangementByContainerId: Record<string, ContainerArrangement>;
  }
  | { kind: 'diagram.rename'; name: string };

interface PlacementInput {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * How a human wants one wire shaped.
 *
 * Every field is optional and merges into what is already stored, so moving a label never
 * silently discards the corridor someone dragged, and vice versa. An empty `waypoints` list is
 * the way to say "route it yourself again" — the absent field means "leave it as it is".
 */
interface RouteInput {
  waypoints?: { x: number; y: number }[];
  /** 0 at the source end, 1 at the target end. */
  labelPosition?: number;
  preferredSourceSide?: PortSide;
  preferredTargetSide?: PortSide;
}

/** What happened to a submitted batch. Every failure is named, none are exceptions. */
export type ChangeOutcome =
  | { status: 'applied'; revision: number; commandsApplied: number }
  | { status: 'duplicate'; originalRevision: number; revision: number }
  | { status: 'conflict'; expectedRevision: number; actualRevision: number }
  | { status: 'rejected'; reason: string; commandIndex?: number };

/** One opened diagram's authority over its own content, revision, and history. */
export interface CanvasWorkspace {
  snapshot(): DiagramRecord;
  submit(changeSet: RecordChangeSet): ChangeOutcome;
  /** Convenience for host interactions; wraps one command in a fully attributed batch. */
  execute(command: RecordCommand): ChangeOutcome;
  canUndo(): boolean;
  undo(): boolean;
  subscribe(listener: () => void): () => void;
}

class WorkspaceError extends Error {
  readonly commandIndex: number;

  constructor(commandIndex: number, message: string) {
    super(message);
    this.name = 'WorkspaceError';
    this.commandIndex = commandIndex;
  }
}

function activeView(record: DiagramRecord): DiagramRecord['views'][string] {
  const view = record.views[record.activeViewId];
  if (!view) throw new Error(`unknown-view:${record.activeViewId}`);
  return view;
}

function requireNode(record: DiagramRecord, id: string): void {
  if (!record.nodes[id]) throw new Error(`node-not-found:${id}`);
}

function requireWireEndpoint(record: DiagramRecord, id: string): void {
  requireNode(record, id);
  if (componentFor(record.nodes[id].kind).identity?.wireEndpoint === false) {
    throw new Error(`node-not-a-wire-endpoint:${id}`);
  }
}

/**
 * What a name in a signature is allowed to be.
 *
 * Chris: a node's body "would need to conform to typescript or some standard so people don't
 * write random stuff." A TypeScript identifier is that standard, and it is the one the diagrams
 * already follow — `acquire`, `AgentId`, `SessionHandle`. Generic and array forms are allowed
 * because real signatures use them (`Frame[]`), but prose is not: a signature that cannot be
 * read as code is a note, and notes belong in the description.
 */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*(<[A-Za-z0-9_$,\s[\]<>]+>)?(\[\])*$/;

export function isSignatureName(value: string): boolean {
  return IDENTIFIER.test(value.trim());
}

/** Rejects a signature the model could not render, naming the part that was wrong. */
function requireSignature(
  name: string | undefined,
  accepts: readonly string[] | undefined,
  returns: readonly string[] | undefined,
): void {
  if (name !== undefined) {
    if (name.trim().length === 0) throw new Error('interface-name-empty');
    if (!isSignatureName(name)) throw new Error(`interface-name-not-an-identifier:${name}`);
  }
  for (const [role, list] of [['accepts', accepts], ['returns', returns]] as const) {
    for (const entry of list ?? []) {
      if (!isSignatureName(entry)) throw new Error(`${role}-not-a-type:${entry}`);
    }
  }
}

function validate(record: DiagramRecord, command: RecordCommand): void {
  switch (command.kind) {
    case 'node.add':
      if (record.nodes[command.node.id]) throw new Error(`node-already-exists:${command.node.id}`);
      if (command.node.parentId) {
        requireNode(record, command.node.parentId);
        if (record.nodes[command.node.parentId].kind !== 'group') {
          throw new Error(`parent-not-a-group:${command.node.parentId}`);
        }
      }
      return;
    case 'node.move': case 'node.resize': case 'node.pin': case 'node.remove':
      requireNode(record, command.id);
      return;
    case 'node.update':
      requireNode(record, command.id);
      if (command.patch.label !== undefined && command.patch.label !== record.nodes[command.id].label
        && componentFor(record.nodes[command.id].kind).identity?.scope === 'parent') {
        throw new Error(`parent-scoped-identity-requires-recreate:${command.id}`);
      }
      return;
    case 'node.reparent': {
      requireNode(record, command.id);
      if (command.parentId !== record.nodes[command.id].parentId
        && componentFor(record.nodes[command.id].kind).identity?.scope === 'parent') {
        throw new Error(`parent-scoped-identity-requires-recreate:${command.id}`);
      }
      if (!command.parentId) return;
      requireNode(record, command.parentId);
      if (record.nodes[command.parentId].kind !== 'group') {
        throw new Error(`parent-not-a-group:${command.parentId}`);
      }
      let cursor: string | undefined = command.parentId;
      while (cursor) {
        if (cursor === command.id) throw new Error('parent-cycle');
        cursor = record.nodes[cursor]?.parentId;
      }
      return;
    }
    case 'wire.add':
      if (record.wires[command.wire.id]) throw new Error(`wire-already-exists:${command.wire.id}`);
      requireWireEndpoint(record, command.wire.source.nodeId);
      requireWireEndpoint(record, command.wire.target.nodeId);
      return;
    case 'wire.reconnect':
      if (!record.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
      if (command.source) requireWireEndpoint(record, command.source);
      if (command.target) requireWireEndpoint(record, command.target);
      return;
    case 'wire.setRoute': {
      if (!record.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
      const { labelPosition, waypoints } = command.route;
      if (labelPosition !== undefined
        && (!Number.isFinite(labelPosition) || labelPosition < 0 || labelPosition > 1)) {
        throw new Error(`label-position-off-wire:${labelPosition}`);
      }
      if (waypoints?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
        throw new Error('waypoint-not-a-position');
      }
      return;
    }
    case 'wire.update': case 'wire.remove':
      if (!record.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
      return;
    case 'interface.add':
      requireNode(record, command.ownerId);
      if (componentFor(record.nodes[command.ownerId].kind).allowsMembers === false) {
        throw new Error(`node-does-not-accept-interfaces:${command.ownerId}`);
      }
      if (record.interfaces[command.iface.id]) {
        throw new Error(`interface-already-exists:${command.iface.id}`);
      }
      requireSignature(command.iface.name, command.iface.accepts, command.iface.returns);
      return;
    case 'interface.update':
      if (!record.interfaces[command.id]) throw new Error(`interface-not-found:${command.id}`);
      requireSignature(command.patch.name, command.patch.accepts, command.patch.returns);
      return;
    case 'interface.remove':
      if (!record.interfaces[command.id]) throw new Error(`interface-not-found:${command.id}`);
      return;
    case 'view.setCollapsed':
      requireNode(record, command.id);
      if (record.nodes[command.id].kind !== 'group') throw new Error(`not-a-group:${command.id}`);
      return;
    case 'view.setViewport':
      return;
    case 'layout.presentation.replace': {
      layoutPresentationSchema.parse({
        appearanceByNodeId: command.appearanceByNodeId,
        arrangementByContainerId: command.arrangementByContainerId,
      });
      if (Object.keys(command.arrangementByContainerId).length > 0) {
        throw new Error('container-arrangements-not-active');
      }
      for (const [nodeId, appearance] of Object.entries(command.appearanceByNodeId)) {
        requireNode(record, nodeId);
        const allowed = componentFor(record.nodes[nodeId].kind).appearanceKeys ?? [];
        for (const jsonKey of Object.keys(appearance)) {
          const key = appearanceKeyForJsonKey(jsonKey);
          if (!key || !allowed.includes(key)) {
            throw new Error(`appearance-not-supported:${nodeId}:${jsonKey}`);
          }
        }
      }
      return;
    }
    case 'diagram.rename':
      if (command.name.trim().length === 0) throw new Error('diagram-name-empty');
  }
}

function apply(record: DiagramRecord, command: RecordCommand): DiagramRecord {
  const next = structuredClone(record);
  const layout = next.layouts[activeView(next).layoutId];
  const view = next.views[next.activeViewId];

  switch (command.kind) {
    case 'node.add':
      next.nodes[command.node.id] = command.node;
      layout.placements[command.node.id] = {
        nodeId: command.node.id as never,
        position: command.placement.position,
        size: command.placement.size,
        pinned: false,
      };
      break;
    case 'node.move':
      layout.placements[command.id] = { ...layout.placements[command.id], position: command.position };
      break;
    case 'node.resize':
      layout.placements[command.id] = { ...layout.placements[command.id], size: command.size };
      break;
    case 'node.pin':
      layout.placements[command.id] = { ...layout.placements[command.id], pinned: command.pinned };
      break;
    case 'node.update':
      Object.assign(next.nodes[command.id], command.patch);
      break;
    case 'node.reparent':
      if (command.parentId) next.nodes[command.id].parentId = command.parentId as never;
      else delete next.nodes[command.id].parentId;
      break;
    case 'node.remove': {
      // A removed node takes what only existed because of it: its wires, its geometry, and the
      // interfaces it owns. Types are deliberately left alone — they carry no owner and real
      // diagrams share one type across several nodes (`project-resource` belongs to both
      // `resources` and `storyboard`), so deleting them with a node would dangle live
      // references on the very data this is meant to protect.
      const owned = next.nodes[command.id];
      for (const interfaceId of owned.interfaceIds) delete next.interfaces[interfaceId];
      delete next.nodes[command.id];
      next.wires = Object.fromEntries(Object.entries(next.wires).filter(
        ([, wire]) => wire.source.nodeId !== command.id && wire.target.nodeId !== command.id,
      ));
      for (const each of Object.values(next.layouts)) delete each.placements[command.id];
      for (const each of Object.values(next.layouts)) {
        if (each.appearanceByNodeId) delete each.appearanceByNodeId[command.id];
        if (each.arrangementByContainerId) delete each.arrangementByContainerId[command.id];
      }
      view.collapsedNodeIds = view.collapsedNodeIds.filter((id) => id !== command.id);
      break;
    }
    case 'wire.add':
      next.wires[command.wire.id] = command.wire;
      break;
    case 'wire.reconnect': {
      const wire = next.wires[command.id];
      if (command.source) wire.source = { ...wire.source, nodeId: command.source as never };
      if (command.target) wire.target = { ...wire.target, nodeId: command.target as never };
      break;
    }
    case 'wire.setRoute': {
      // The hint belongs to the arrangement, not to the relationship: the same wire can be
      // shaped one way in one layout and another way in another.
      const existing: WireRouteHint = layout.wireRouteHints[command.id]
        ?? { wireId: command.id as never, waypoints: [] };
      const { labelPosition, preferredSourceSide, preferredTargetSide, waypoints } = command.route;
      layout.wireRouteHints[command.id] = {
        ...existing,
        ...(waypoints ? { waypoints: waypoints.map((point) => ({ ...point })) } : {}),
        ...(labelPosition === undefined ? {} : { labelPosition }),
        ...(preferredSourceSide === undefined ? {} : { preferredSourceSide }),
        ...(preferredTargetSide === undefined ? {} : { preferredTargetSide }),
      };
      break;
    }
    case 'wire.update':
      Object.assign(next.wires[command.id], command.patch);
      break;
    case 'interface.add':
      next.interfaces[command.iface.id] = command.iface;
      next.nodes[command.ownerId].interfaceIds = [
        ...next.nodes[command.ownerId].interfaceIds, command.iface.id,
      ] as never;
      break;
    case 'interface.update':
      Object.assign(next.interfaces[command.id], command.patch);
      break;
    case 'interface.remove': {
      // An interface belongs to its owner, so removing it takes the reference with it — a node
      // pointing at an interface that is gone would render as a blank row nobody can delete.
      const owner = next.interfaces[command.id].ownerId;
      delete next.interfaces[command.id];
      if (next.nodes[owner]) {
        next.nodes[owner].interfaceIds = next.nodes[owner].interfaceIds
          .filter((id) => id !== command.id) as never;
      }
      break;
    }
    case 'wire.remove':
      delete next.wires[command.id];
      for (const each of Object.values(next.layouts)) delete each.wireRouteHints[command.id];
      break;
    case 'view.setCollapsed': {
      const collapsed = new Set(view.collapsedNodeIds as string[]);
      if (command.collapsed) collapsed.add(command.id);
      else collapsed.delete(command.id);
      view.collapsedNodeIds = [...collapsed].sort() as never;
      break;
    }
    case 'view.setViewport':
      view.viewport = command.viewport;
      break;
    case 'layout.presentation.replace':
      layout.appearanceByNodeId = structuredClone(command.appearanceByNodeId);
      layout.arrangementByContainerId = structuredClone(command.arrangementByContainerId);
      break;
    case 'diagram.rename':
      next.name = command.name;
      break;
  }
  return next;
}

/**
 * Opens one diagram record as a mutable workspace.
 *
 * The record is the unit of revision, so an agent editing one diagram cannot conflict with a
 * human editing another. Undo restores prior content exactly; the operation ledger is
 * deliberately excluded from that restoration and only ever grows, because an undo that
 * forgot an operation ID would let a replay of it apply a second time.
 */
export function createCanvasWorkspace(
  initial: DiagramRecord,
  context: ActorContext,
  options: { historyLimit?: number } = {},
): CanvasWorkspace {
  const historyLimit = options.historyLimit ?? 50;
  let record = initial;
  const history: DiagramRecord[] = [];
  const listeners = new Set<() => void>();
  const publish = (): void => listeners.forEach((listener) => listener());

  const remember = (state: DiagramRecord): void => {
    history.push(state);
    if (history.length > historyLimit) history.shift();
  };

  const submit = (changeSet: RecordChangeSet): ChangeOutcome => {
    const alreadyApplied = record.appliedOperations[changeSet.operationId];
    if (alreadyApplied) {
      return {
        status: 'duplicate',
        originalRevision: alreadyApplied.revision,
        revision: record.revision,
      };
    }
    if (changeSet.expectedRevision !== record.revision) {
      return {
        status: 'conflict',
        expectedRevision: changeSet.expectedRevision,
        actualRevision: record.revision,
      };
    }
    if (changeSet.commands.length === 0) {
      return { status: 'rejected', reason: 'empty-change-set' };
    }

    let candidate = record;
    for (let index = 0; index < changeSet.commands.length; index += 1) {
      try {
        validate(candidate, changeSet.commands[index]);
        candidate = apply(candidate, changeSet.commands[index]);
      } catch (error) {
        const failure = error instanceof WorkspaceError ? error.message
          : error instanceof Error ? error.message : String(error);
        return { status: 'rejected', reason: failure, commandIndex: index };
      }
    }

    const revision = record.revision + 1;
    remember(record);
    record = {
      ...candidate,
      revision,
      appliedOperations: {
        ...candidate.appliedOperations,
        [changeSet.operationId]: {
          operationId: changeSet.operationId,
          revision,
          actor: structuredClone(context.actor),
          timestamp: changeSet.timestamp,
          provenance: structuredClone(context.provenance),
          commandKinds: changeSet.commands.map((command) => command.kind),
        },
      },
    };
    publish();
    return { status: 'applied', revision, commandsApplied: changeSet.commands.length };
  };

  return {
    snapshot: () => record,
    submit,
    execute(command) {
      return submit({
        operationId: `${context.provenance.source}-${globalThis.crypto.randomUUID()}`,
        expectedRevision: record.revision,
        timestamp: new Date().toISOString(),
        commands: [command],
      });
    },
    canUndo: () => history.length > 0,
    undo() {
      const previous = history.pop();
      if (!previous) return false;
      record = {
        ...previous,
        revision: record.revision + 1,
        appliedOperations: record.appliedOperations,
      };
      publish();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
