import type { ArchitectureDocument, CanvasCommand } from './model';
import { layoutScopes } from './layout.ts';
import {
  addNodePlacement, placementFor, removeNodePlacements, replacePlacement,
} from './layouts.ts';
import { applyLayoutProposal } from './layout-proposal.ts';

export class CanvasCommandError extends Error {
  readonly commandIndex: number;

  constructor(commandIndex: number, message: string) {
    super(message);
    this.name = 'CanvasCommandError';
    this.commandIndex = commandIndex;
  }
}

function requireNode(document: ArchitectureDocument, id: string): void {
  if (!document.nodes[id]) throw new Error(`node-not-found:${id}`);
}

/** Rejects invalid intentions before an atomic public batch is committed. */
export function validateCanvasCommand(document: ArchitectureDocument, command: CanvasCommand): void {
  switch (command.kind) {
    case 'node.add':
      if (document.nodes[command.node.id]) throw new Error(`node-already-exists:${command.node.id}`);
      if (command.node.id !== command.placement.nodeId) throw new Error('placement-node-id-mismatch');
      if (command.node.parentId) requireNode(document, command.node.parentId);
      return;
    case 'node.move': case 'node.resize': case 'node.pin': case 'node.update': case 'node.remove':
      requireNode(document, command.id);
      return;
    case 'wire.add':
      if (document.wires[command.wire.id]) throw new Error(`wire-already-exists:${command.wire.id}`);
      requireNode(document, command.wire.source);
      requireNode(document, command.wire.target);
      return;
    case 'wire.update': case 'wire.remove':
      if (!document.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
      return;
    case 'wire.reconnect':
      if (!document.wires[command.id]) throw new Error(`wire-not-found:${command.id}`);
      requireNode(document, command.source);
      requireNode(document, command.target);
      return;
    case 'layout.apply':
      if (document.revision !== command.proposal.baseRevision) throw new Error('stale-layout-proposal');
      return;
    case 'scope.layout':
      requireNode(document, command.id);
      if (document.nodes[command.id].kind !== 'scope') throw new Error(`not-a-scope:${command.id}`);
  }
}

function applyCanvasMutation(
  document: ArchitectureDocument,
  command: CanvasCommand,
): ArchitectureDocument {
  let next = structuredClone(document);
  switch (command.kind) {
    case 'node.add':
      next.nodes[command.node.id] = command.node;
      next = addNodePlacement(next, command.node, command.placement);
      break;
    case 'node.move': {
      const placement = placementFor(next, command.id, command.layoutId);
      next = replacePlacement(next, { ...placement, position: command.position }, command.layoutId);
      break;
    }
    case 'node.resize': {
      const placement = placementFor(next, command.id, command.layoutId);
      next = replacePlacement(next, { ...placement, size: command.size }, command.layoutId);
      break;
    }
    case 'node.pin': {
      const placement = placementFor(next, command.id, command.layoutId);
      next = replacePlacement(next, { ...placement, pinned: command.pinned }, command.layoutId);
      break;
    }
    case 'node.update': Object.assign(next.nodes[command.id], command.patch); break;
    case 'node.remove':
      delete next.nodes[command.id];
      next.wires = Object.fromEntries(
        Object.entries(next.wires).filter(([, wire]) => wire.source !== command.id && wire.target !== command.id),
      );
      next = removeNodePlacements(next, command.id);
      break;
    case 'wire.add': next.wires[command.wire.id] = command.wire; break;
    case 'wire.update': Object.assign(next.wires[command.id], command.patch); break;
    case 'wire.reconnect':
      next.wires[command.id] = { ...next.wires[command.id], source: command.source, target: command.target };
      break;
    case 'wire.remove': delete next.wires[command.id]; break;
    case 'layout.apply': next = applyLayoutProposal(next, command.proposal); break;
    case 'scope.layout': next = layoutScopes(next, [command.id], command.layoutId, command.groupPadding); break;
  }
  return next;
}

/** Applies a validated command list as one revision. */
export function applyCanvasCommandBatch(
  document: ArchitectureDocument,
  commands: CanvasCommand[],
): ArchitectureDocument {
  let next = document;
  for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
    try {
      validateCanvasCommand(next, commands[commandIndex]);
      next = applyCanvasMutation(next, commands[commandIndex]);
    } catch (error) {
      throw new CanvasCommandError(
        commandIndex,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { ...next, revision: document.revision + 1 };
}

/** Applies one intention without mutating the previous document. */
export function applyCanvasCommand(
  document: ArchitectureDocument,
  command: CanvasCommand,
): ArchitectureDocument {
  return applyCanvasCommandBatch(document, [command]);
}
