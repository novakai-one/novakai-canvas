import type { CrossDiagramLink, DiagramRecord } from '../../contract/records/index.ts';
import { rootGroupId } from '../export/ordering.ts';

/** One map as the CLI listing presents it. */
export interface MapSummary {
  id: string;
  label: string;
  nodes: number;
  wires: number;
}

/** Lists maps in record order with visible node and wire counts. */
export function listMaps(
  records: readonly DiagramRecord[],
  links: readonly CrossDiagramLink[] = [],
): MapSummary[] {
  return records.map((record) => {
    const rootId = rootGroupId(record);
    const outbound = links.filter((link) => link.source.diagramId === record.id).length;
    return {
      id: record.id as string,
      label: (rootId ? record.nodes[rootId]?.label : undefined) ?? record.name,
      nodes: Object.keys(record.nodes).length - (rootId ? 1 : 0),
      wires: Object.keys(record.wires).length + outbound,
    };
  });
}
