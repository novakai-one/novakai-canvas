/** Framework-free public surface shared by the web host, CLI, agents, and future Novakai host. */
export { createCanvasEngine, type CanvasEngine } from './application/canvas-engine.ts';
export type { JsonRepository } from './application/json-repository.ts';
export {
  createCanvasObjectStoreRepository,
  type CanvasDocumentRecord,
  type CanvasObjectStore,
} from './adapters/canvas-object-store-repository.ts';
export { previewLayout, applyLayoutProposal } from './domain/layout-proposal.ts';
export { findSubjectOccurrences, linkedArchitectureMap, listArchitectureMaps } from './domain/maps.ts';
export { architectureDocumentSchema, canvasChangeSetSchema } from './domain/schema.ts';
export type {
  AppliedCanvasOperation,
  ArchitectureDocument,
  CanvasActor,
  CanvasCapabilityDescription,
  CanvasChangeOutcome,
  CanvasChangeSet,
  CanvasCommand,
  CanvasDiagram,
  CanvasLayout,
  CanvasImportSet,
  CanvasNode,
  CanvasProvenance,
  CanvasReference,
  CanvasWire,
  LayoutProposal,
  LayoutRequest,
  LayoutTarget,
  NodePlacement,
  SourceReference,
  WireRouteHint,
} from './domain/model.ts';
