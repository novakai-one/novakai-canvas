/** Durable authorship vocabulary shared by V2 documents and commands without an import cycle. */
export interface CanvasActor { id: string; kind: 'human' | 'agent' | 'system' }

export interface CanvasProvenance {
  source: 'ui' | 'cli' | 'agent' | 'import' | 'system';
  sourceRef?: string;
}

export type CanvasCommandKind =
  | 'diagram.create' | 'diagram.setStatus' | 'diagram.setReferences'
  | 'node.add' | 'node.move' | 'node.resize' | 'node.pin' | 'node.update'
  | 'node.setSubject' | 'node.setDetailDiagram' | 'node.reparent' | 'node.setCollapsed'
  | 'node.remove' | 'wire.add' | 'wire.update' | 'wire.reconnect' | 'wire.remove'
  | 'layout.apply' | 'scope.layout';

export interface AppliedCanvasOperation {
  operationId: string;
  revision: number;
  actor: CanvasActor;
  timestamp: string;
  provenance: CanvasProvenance;
  commandKinds: Array<CanvasCommandKind | 'document.import'>;
}
