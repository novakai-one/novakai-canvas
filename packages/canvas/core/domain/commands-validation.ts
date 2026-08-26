import type { CanvasCommand } from '../../contract/records/legacy-commands.ts';
import type { ArchitectureDocument } from '../../contract/records/legacy-document.ts';

function requireNode(document: ArchitectureDocument, id: string): void {
  if (!document.nodes[id]) throw new Error(`node-not-found:${id}`);
}

/** Rejects invalid intentions before an atomic public batch is committed. */
export function validateCanvasCommand(document: ArchitectureDocument, command: CanvasCommand): void {
  switch (command.kind) {
    case 'diagram.create':
      if (document.diagrams[command.diagram.id]) throw new Error(`diagram-already-exists:${command.diagram.id}`);
      if (document.nodes[command.root.id]) throw new Error(`node-already-exists:${command.root.id}`);
      if (command.root.kind !== 'scope' || command.root.parentId) throw new Error('diagram-root-must-be-top-level-scope');
      if (command.diagram.rootNodeId !== command.root.id || command.placement.nodeId !== command.root.id) {
        throw new Error('diagram-root-id-mismatch');
      }
      return;
    case 'diagram.setStatus': case 'diagram.setReferences':
      if (!document.diagrams[command.id]) throw new Error(`diagram-not-found:${command.id}`);
      return;
    case 'node.add':
      if (document.nodes[command.node.id]) throw new Error(`node-already-exists:${command.node.id}`);
      if (command.node.id !== command.placement.nodeId) throw new Error('placement-node-id-mismatch');
      if (command.node.parentId) {
        requireNode(document, command.node.parentId);
        if (document.nodes[command.node.parentId].kind !== 'scope') {
          throw new Error(`parent-not-a-group:${command.node.parentId}`);
        }
      }
      if (command.node.expandsToDiagramId && !document.diagrams[command.node.expandsToDiagramId]) {
        throw new Error(`diagram-not-found:${command.node.expandsToDiagramId}`);
      }
      return;
    case 'node.move': case 'node.resize': case 'node.pin':
    case 'node.update': case 'node.setSubject':
      requireNode(document, command.id);
      return;
    case 'node.setDetailDiagram':
      requireNode(document, command.id);
      if (command.diagramId && !document.diagrams[command.diagramId]) throw new Error(`diagram-not-found:${command.diagramId}`);
      return;
    case 'node.remove':
      requireNode(document, command.id);
      if (Object.values(document.diagrams).some((diagram) => diagram.rootNodeId === command.id)) {
        throw new Error(`cannot-remove-diagram-root:${command.id}`);
      }
      return;
    case 'node.reparent': {
      requireNode(document, command.id);
      requireNode(document, command.parentId);
      if (document.nodes[command.parentId].kind !== 'scope') throw new Error(`parent-not-a-group:${command.parentId}`);
      let cursor: string | undefined = command.parentId;
      while (cursor) {
        if (cursor === command.id) throw new Error('parent-cycle');
        cursor = document.nodes[cursor]?.parentId;
      }
      return;
    }
    case 'node.setCollapsed':
      requireNode(document, command.id);
      if (document.nodes[command.id].kind !== 'scope') throw new Error(`not-a-group:${command.id}`);
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
