/** Public pure interface for every diagram text export. */

import type { DiagramRecord } from '../domain/records.ts';
import type { DiagramExportContext, DiagramExportFormat } from './contract.ts';
import { printLibrary } from './dsl.ts';
import { printMarkdown } from './markdown.ts';

function completeContext(
  records: readonly DiagramRecord[],
  context: DiagramExportContext,
): DiagramExportContext {
  return {
    links: context.links,
    records: {
      ...context.records,
      ...Object.fromEntries(records.map((record) => [record.id as string, record])),
    },
  };
}

/** Exports one diagram through the same format authority used by every host. */
export function exportDiagram(
  record: DiagramRecord,
  context: DiagramExportContext,
  format: DiagramExportFormat,
): string {
  return exportDiagrams([record], context, format);
}

/** Exports one or more diagrams without reading storage, globals, or host state. */
export function exportDiagrams(
  records: readonly DiagramRecord[],
  context: DiagramExportContext,
  format: DiagramExportFormat,
): string {
  if (records.length === 0) throw new Error('diagram-export-needs-record');
  if (format === 'json') {
    return JSON.stringify(records.length === 1 ? records[0] : records, null, 2);
  }
  const complete = completeContext(records, context);
  const dsl = printLibrary(records, complete);
  if (format === 'dsl') return dsl;
  if (format === 'agent') return `\`\`\`canvas\n${dsl}\`\`\`\n`;
  return printMarkdown(records, complete);
}
