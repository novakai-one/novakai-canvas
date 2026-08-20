/** Dependency-free SVG snapshot of one scope and its nested zones. */

import type { DiagramRecord } from '../../src/canvas.ts';
import { ARCHITECTURE_FLOW } from '../../src/domain/flow.ts';
import { renderSnapshotNodes, renderSnapshotZones } from './snapshot/nodes.ts';
import { buildSnapshotScene } from './snapshot/scene.ts';
import { renderSvgFrame } from './snapshot/svg.ts';
import { renderSnapshotWires } from './snapshot/wires.ts';

/** Renders one record to a standalone SVG string in stable visual-layer order. */
export function renderRecordSvg(record: DiagramRecord): string {
  if (ARCHITECTURE_FLOW.sourcePort !== 'bottom' || ARCHITECTURE_FLOW.targetPort !== 'top') {
    throw new Error('snapshot renderer requires top-to-bottom architecture flow');
  }
  const scene = buildSnapshotScene(record);
  const parts = [
    ...renderSvgFrame(scene),
    ...renderSnapshotZones(scene),
    ...renderSnapshotWires(scene),
    ...renderSnapshotNodes(record, scene),
    '</svg>',
  ];
  return `${parts.join('\n')}\n`;
}
