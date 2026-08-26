/** Storage-backed context adapter for the pure diagram export capability. */

import type { DiagramExportService, DiagramExportFormat } from '../export/contract.ts';
import { exportDiagrams } from '../export/export-diagrams.ts';
import type { DiagramRecord } from '../../contract/records/index.ts';
import type { CanvasLibrary } from '../../contract/library.ts';
import type { CanvasLibraryRepository } from '../../contract/ports/library-repository.ts';

/** Composes current snapshots with linked records without teaching either host record traversal. */
export function createDiagramExportService(
  repository: CanvasLibraryRepository,
  library: CanvasLibrary,
): DiagramExportService {
  return {
    async render(records: readonly DiagramRecord[], format: DiagramExportFormat): Promise<string> {
      if (records.length === 0) throw new Error('diagram-export-needs-record');
      const selected = new Map(records.map((record) => [record.id as string, record]));
      if (format === 'json') {
        return exportDiagrams(records, { records: Object.fromEntries(selected), links: [] }, format);
      }
      const links = Object.values(library.index().links);
      const required = new Set<string>();
      for (const link of links) {
        if (!selected.has(link.source.diagramId as string)
          && !selected.has(link.target.diagramId as string)) continue;
        required.add(link.source.diagramId as string);
        required.add(link.target.diagramId as string);
      }
      await Promise.all([...required].map(async (id) => {
        if (!selected.has(id)) selected.set(id, await repository.readDiagram(id));
      }));
      return exportDiagrams(
        records,
        { records: Object.fromEntries(selected), links },
        format,
      );
    },
  };
}
