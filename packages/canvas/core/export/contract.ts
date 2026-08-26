import type { CrossDiagramLink, DiagramRecord } from '../../contract/records/index.ts';

/** Every text product the shared exporter can produce. */
export const DIAGRAM_EXPORT_FORMATS = ['dsl', 'agent', 'markdown', 'json'] as const;
export type DiagramExportFormat = (typeof DIAGRAM_EXPORT_FORMATS)[number];

/** Complete semantic context for relationships that cross record boundaries. */
export interface DiagramExportContext {
  records: Readonly<Record<string, DiagramRecord>>;
  links: readonly CrossDiagramLink[];
}

/** Host-neutral asynchronous export capability composed over a diagram library. */
export interface DiagramExportService {
  render(records: readonly DiagramRecord[], format: DiagramExportFormat): Promise<string>;
}
