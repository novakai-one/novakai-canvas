import type { ArchitectureDocument, CanvasCommand } from './model';

/** Applies one intention without mutating the previous document. */
export function applyCanvasCommand(
  document: ArchitectureDocument,
  command: CanvasCommand,
): ArchitectureDocument {
  const next = structuredClone(document);
  switch (command.kind) {
    case 'node.add': next.nodes[command.node.id] = command.node; break;
    case 'node.move': if (next.nodes[command.id]) next.nodes[command.id].position = command.position; break;
    case 'node.update': if (next.nodes[command.id]) Object.assign(next.nodes[command.id], command.patch); break;
    case 'node.remove':
      delete next.nodes[command.id];
      next.wires = Object.fromEntries(
        Object.entries(next.wires).filter(([, wire]) => wire.source !== command.id && wire.target !== command.id),
      );
      break;
    case 'wire.add': next.wires[command.wire.id] = command.wire; break;
    case 'wire.update': if (next.wires[command.id]) Object.assign(next.wires[command.id], command.patch); break;
    case 'wire.remove': delete next.wires[command.id]; break;
  }
  next.revision += 1;
  return next;
}
