/** Framework-free public surface shared by the web host, CLI, agents, and future Novakai host. */
export { createCanvasEngine, type CanvasEngine } from './application/canvas-engine.ts';
export type { JsonRepository } from './application/json-repository.ts';
export { previewLayout, applyLayoutProposal } from './domain/layout-proposal.ts';
export { architectureDocumentSchema, canvasChangeSetSchema } from './domain/schema.ts';
export type {
  AppliedCanvasOperation,
  ArchitectureDocument,
  CanvasActor,
  CanvasCapabilityDescription,
  CanvasChangeOutcome,
  CanvasChangeSet,
  CanvasCommand,
  CanvasLayout,
  CanvasNode,
  CanvasProvenance,
  CanvasWire,
  LayoutProposal,
  LayoutRequest,
  LayoutTarget,
  NodePlacement,
  WireRouteHint,
} from './domain/model.ts';
