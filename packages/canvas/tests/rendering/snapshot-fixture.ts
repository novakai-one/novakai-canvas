import {
  orientationOf, planWireRoutes, projectView, resolveAxis, type DiagramRecord,
} from '@novakai/canvas';
import { buildRecord } from '../fixtures/dsl.ts';
import { blankRecord } from '@novakai/canvas';
import { asId, type RecordNode, type RecordPlacement, type RecordWire } from '@novakai/canvas';
import { renderRecordSvg } from '@novakai/canvas';
import { wirePath } from '@novakai/canvas';

export const DSL = `
scope "Snap & Demo"
  note "Escaping <matters> & renders."
  module "Broker <A>" "Owns leases & grants"
    acquire(AgentId) -> SessionHandle
  module Client
  wire Client -> "Broker <A>" shape=straight : acquire(AgentId) -> SessionHandle [queries]
`;

export function build(): DiagramRecord {
  return buildRecord(DSL);
}

/** Fabricated nested map: zone in zone, a deep node, a Standalone zone, three wires. */
export function buildNested(): DiagramRecord {
  const node = (
    id: string, kind: RecordNode['kind'], label: string, parentId?: string,
  ): RecordNode => ({
    id: asId(id),
    kind,
    label,
    ...(parentId ? { parentId: asId<never>(parentId) } : {}),
    interfaceIds: [],
    typeIds: [],
  });
  const place = (
    id: string, x: number, y: number, width: number, height: number,
  ): RecordPlacement => ({
    nodeId: asId(id), position: { x, y }, size: { width, height }, pinned: false,
  });
  const wire = (
    id: string, source: string, target: string, label: string, kind: RecordWire['kind'],
  ): RecordWire => ({
    id: asId(id), kind, label, source: { nodeId: asId(source) }, target: { nodeId: asId(target) },
  });

  const nodes = [
    node('map', 'group', 'Nested Map'),
    node('zone-a', 'group', 'Zone A', 'map'),
    node('zone-b', 'group', 'Zone B', 'zone-a'),
    node('deep', 'module', 'Deep Node', 'zone-b'),
    node('shallow', 'module', 'Shallow Node', 'map'),
    node('standalone', 'group', 'Standalone Tools', 'map'),
  ];
  const placements = [
    place('map', 0, 0, 800, 600),
    place('zone-a', 40, 60, 400, 400),
    place('zone-b', 30, 50, 300, 250),
    place('deep', 20, 40, 160, 80),
    place('shallow', 500, 100, 160, 80),
    place('standalone', 500, 300, 200, 150),
  ];
  const wires = [
    wire('w-node-node', 'shallow', 'deep', 'node to node', 'queries'),
    wire('w-zone-node', 'zone-a', 'deep', 'zone to node', 'owns'),
    wire('w-zone-zone', 'zone-a', 'standalone', 'zone to zone', 'assigns'),
  ];

  const record = blankRecord('map', 'Nested Map');
  return {
    ...record,
    nodes: Object.fromEntries(nodes.map((each) => [each.id, each])),
    wires: Object.fromEntries(wires.map((each) => [each.id, each])),
    layouts: {
      'layout-default': {
        ...record.layouts['layout-default'],
        placements: Object.fromEntries(placements.map((each) => [each.nodeId, each])),
      },
    },
  };
}


export { orientationOf, planWireRoutes, projectView, resolveAxis, buildRecord, blankRecord, renderRecordSvg, wirePath };
