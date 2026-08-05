import type { ArchitectureDocument, CanvasCommand } from './model';
import { layoutScopes } from './layout.ts';
import {
  addNodePlacement, placementFor, removeNodePlacements, replacePlacement,
} from './layouts';

/** Applies one intention without mutating the previous document. */
export function applyCanvasCommand(
  document: ArchitectureDocument,
  command: CanvasCommand,
): ArchitectureDocument {
  let next = structuredClone(document);
  switch (command.kind) {
    case 'node.add':
      next.nodes[command.node.id] = command.node;
      next = addNodePlacement(next, command.node, command.placement);
      break;
    case 'node.move':
      if (next.nodes[command.id]) {
        const placement = placementFor(next, command.id, command.layoutId);
        next = replacePlacement(next, { ...placement, position: command.position }, command.layoutId);
      }
      break;
    case 'node.resize':
      if (next.nodes[command.id]) {
        const placement = placementFor(next, command.id, command.layoutId);
        next = replacePlacement(next, { ...placement, size: command.size }, command.layoutId);
      }
      break;
    case 'node.update': if (next.nodes[command.id]) Object.assign(next.nodes[command.id], command.patch); break;
    case 'node.remove':
      delete next.nodes[command.id];
      next.wires = Object.fromEntries(
        Object.entries(next.wires).filter(([, wire]) => wire.source !== command.id && wire.target !== command.id),
      );
      next = removeNodePlacements(next, command.id);
      break;
    case 'wire.add': next.wires[command.wire.id] = command.wire; break;
    case 'wire.update': if (next.wires[command.id]) Object.assign(next.wires[command.id], command.patch); break;
    case 'wire.reconnect':
      if (next.wires[command.id] && next.nodes[command.source] && next.nodes[command.target]) {
        next.wires[command.id] = {
          ...next.wires[command.id], source: command.source, target: command.target,
        };
      }
      break;
    case 'wire.remove': delete next.wires[command.id]; break;
    case 'scope.layout': next = layoutScopes(next, [command.id], command.layoutId, command.groupPadding); break;
  }
  next.revision += 1;
  return next;
}
