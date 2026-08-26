import { describe, expect, it } from 'vitest';
import { applyCanvasCommand } from '@novakai/canvas';
import { emptyArchitecture } from '@novakai/canvas';
import { findSubjectOccurrences, listArchitectureMaps } from '@novakai/canvas';

describe('diagram library', () => {
  it('creates and archives an independently identified diagram', () => {
    const created = applyCanvasCommand(structuredClone(emptyArchitecture), {
      kind: 'diagram.create',
      diagram: { id: 'diagram-system', rootNodeId: 'root-system', status: 'active', sourceRefs: [] },
      root: {
        id: 'root-system', kind: 'scope', label: 'System flow', interfaceIds: [], typeIds: [],
      },
      placement: {
        nodeId: 'root-system', position: { x: 0, y: 0 },
        size: { width: 900, height: 600 }, pinned: false,
      },
    });
    expect(listArchitectureMaps(created)).toEqual([
      { id: 'diagram-system', rootNodeId: 'root-system', label: 'System flow', status: 'active' },
    ]);

    const archived = applyCanvasCommand(created, {
      kind: 'diagram.setStatus', id: 'diagram-system', status: 'archived',
    });
    expect(listArchitectureMaps(archived)).toEqual([]);
    expect(listArchitectureMaps(archived, true)[0].status).toBe('archived');
  });

  it('stores occurrence identity and a link to a deeper diagram without copying authority', () => {
    let document = structuredClone(emptyArchitecture);
    for (const [diagramId, rootId, label] of [
      ['overview', 'overview-root', 'Overview'],
      ['detail', 'detail-root', 'Detail'],
    ]) {
      document = applyCanvasCommand(document, {
        kind: 'diagram.create',
        diagram: { id: diagramId, rootNodeId: rootId, status: 'active', sourceRefs: [] },
        root: { id: rootId, kind: 'scope', label, interfaceIds: [], typeIds: [] },
        placement: { nodeId: rootId, position: { x: 0, y: 0 }, size: { width: 800, height: 500 }, pinned: false },
      });
    }
    document = applyCanvasCommand(document, {
      kind: 'node.add',
      node: {
        id: 'runtime-occurrence', kind: 'runtime', label: 'Agent runtime', parentId: 'overview-root',
        interfaceIds: [], typeIds: [], subjectRef: { namespace: 'novakai-module', id: 'agent-runtime' },
        expandsToDiagramId: 'detail',
      },
      placement: { nodeId: 'runtime-occurrence', position: { x: 40, y: 40 }, size: { width: 200, height: 100 }, pinned: false },
    });

    expect(document.nodes['runtime-occurrence']).toMatchObject({
      subjectRef: { namespace: 'novakai-module', id: 'agent-runtime' },
      expandsToDiagramId: 'detail',
    });
    expect(document.diagrams.detail.rootNodeId).toBe('detail-root');
    expect(findSubjectOccurrences(document, { namespace: 'novakai-module', id: 'agent-runtime' })).toEqual([
      { diagramId: 'overview', nodeId: 'runtime-occurrence' },
    ]);

    document = applyCanvasCommand(document, {
      kind: 'diagram.setReferences', id: 'detail',
      subjectRef: { namespace: 'novakai-module', id: 'agent-runtime' },
      sourceRefs: [{ namespace: 'code', id: 'packages/agent-runtime', label: 'Runtime package' }],
    });
    expect(document.diagrams.detail.sourceRefs[0].id).toBe('packages/agent-runtime');

    document = applyCanvasCommand(document, {
      kind: 'node.setDetailDiagram', id: 'runtime-occurrence', diagramId: undefined,
    });
    document = applyCanvasCommand(document, {
      kind: 'node.setSubject', id: 'runtime-occurrence', subjectRef: undefined,
    });
    expect(document.nodes['runtime-occurrence']).not.toHaveProperty('expandsToDiagramId');
    expect(document.nodes['runtime-occurrence']).not.toHaveProperty('subjectRef');
  });
});
