import type { CanvasCommand } from '../../contract/records/legacy-commands.ts';
import type { ArchitectureDocument } from '../../contract/records/legacy-document.ts';
import { layoutScopes } from './diagram-geometry.ts';
import {
  addNodePlacement, placementFor, removeNodePlacements, replacePlacement, resolveLayout,
} from './layouts.ts';
import { applyLayoutProposal } from './layout-proposal.ts';
import { validateCanvasCommand } from './commands-validation.ts';
export { validateCanvasCommand } from './commands-validation.ts';

export class CanvasCommandError extends Error {
  readonly commandIndex: number;

  constructor(commandIndex: number, message: string) {
    super(message);
    this.name = 'CanvasCommandError';
    this.commandIndex = commandIndex;
  }
}

function applyCanvasMutation(
  document: ArchitectureDocument,
  command: CanvasCommand,
): ArchitectureDocument {
  let next = structuredClone(document);
  switch (command.kind) {
    case 'diagram.create':
      next.diagrams[command.diagram.id] = command.diagram;
      next.nodes[command.root.id] = command.root;
      next = addNodePlacement(next, command.root, command.placement);
      break;
    case 'diagram.setStatus':
      next.diagrams[command.id] = { ...next.diagrams[command.id], status: command.status };
      break;
    case 'diagram.setReferences':
      next.diagrams[command.id] = {
        ...next.diagrams[command.id],
        ...(command.subjectRef ? { subjectRef: command.subjectRef } : {}),
        sourceRefs: command.sourceRefs,
      };
      if (!command.subjectRef) delete next.diagrams[command.id].subjectRef;
      break;
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
    case 'node.setSubject':
      next.nodes[command.id] = { ...next.nodes[command.id], ...(command.subjectRef ? { subjectRef: command.subjectRef } : {}) };
      if (!command.subjectRef) delete next.nodes[command.id].subjectRef;
      break;
    case 'node.setDetailDiagram':
      next.nodes[command.id] = { ...next.nodes[command.id], ...(command.diagramId ? { expandsToDiagramId: command.diagramId } : {}) };
      if (!command.diagramId) delete next.nodes[command.id].expandsToDiagramId;
      break;
    case 'node.reparent': next.nodes[command.id] = { ...next.nodes[command.id], parentId: command.parentId }; break;
    case 'node.setCollapsed': {
      const layout = resolveLayout(next, command.layoutId);
      const ids = new Set(layout.collapsedNodeIds);
      if (command.collapsed) ids.add(command.id);
      else ids.delete(command.id);
      next.layouts[layout.id] = { ...layout, collapsedNodeIds: [...ids].sort() };
      break;
    }
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
