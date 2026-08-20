import type { CrossDiagramLink } from '../../../src/canvas.ts';

/** Resolves labels for relationships whose far end belongs to another diagram. */
export interface CrossDiagramContext {
  links: CrossDiagramLink[];
  labelOf(diagramId: string, nodeId: string): string | undefined;
}

/** One map as the `maps` listing shows it. */
export interface MapSummary {
  id: string;
  label: string;
  nodes: number;
  wires: number;
}
