import { describe, expect, it } from 'vitest';
import { applyLayoutProposal, previewLayout } from '@novakai/canvas';
import { placementFor } from '@novakai/canvas';
import { parseArchitectureDocument } from '@novakai/canvas';

function document() {
  return parseArchitectureDocument({
    schemaVersion: 1,
    id: 'slice-layout',
    name: 'Slice layout',
    revision: 9,
    nodes: {
      map: {
        id: 'map', kind: 'scope', label: 'Map', position: { x: 20, y: 20 }, size: { width: 1000, height: 700 },
        interfaceIds: [], typeIds: [],
      },
      a: {
        id: 'a', kind: 'module', label: 'A', parentId: 'map', position: { x: 80, y: 80 }, size: { width: 200, height: 100 },
        interfaceIds: [], typeIds: [],
      },
      b: {
        id: 'b', kind: 'module', label: 'B', parentId: 'map', position: { x: 420, y: 80 }, size: { width: 200, height: 100 },
        interfaceIds: [], typeIds: [],
      },
      outside: {
        id: 'outside', kind: 'module', label: 'Outside', parentId: 'map', position: { x: 700, y: 500 }, size: { width: 200, height: 100 },
        interfaceIds: [], typeIds: [],
      },
    },
    interfaces: {},
    types: {},
    wires: {
      link: { id: 'link', source: 'a', target: 'b', label: 'calls', kind: 'executes', routing: 'elbow' },
    },
  });
}

describe('layout proposals', () => {
  it('lays out only named nodes and leaves every outside placement byte-for-byte unchanged', () => {
    const before = document();
    const proposal = previewLayout(before, {
      target: { kind: 'nodes', nodeIds: ['a', 'b'] },
    });
    const previewed = applyLayoutProposal(before, proposal);

    expect(proposal.affectedNodeIds).toEqual(['a', 'b']);
    expect(placementFor(previewed, 'outside')).toEqual(placementFor(before, 'outside'));
    expect(placementFor(previewed, 'map')).toEqual(placementFor(before, 'map'));
    expect(previewed.nodes).toEqual(before.nodes);
    expect(previewed.revision).toBe(before.revision);
    expect(placementFor(previewed, 'b').position).not.toEqual(placementFor(before, 'b').position);
  });

  it('keeps pinned target nodes fixed inside a layout proposal', () => {
    const before = document();
    before.layouts['layout-default'].placements.b.pinned = true;
    const proposal = previewLayout(before, {
      target: { kind: 'nodes', nodeIds: ['a', 'b'] },
    });
    const previewed = applyLayoutProposal(before, proposal);

    expect(placementFor(previewed, 'b')).toEqual(placementFor(before, 'b'));
  });
});
