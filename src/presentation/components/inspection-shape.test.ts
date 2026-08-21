import { describe, expect, it } from 'vitest';
import type { RecordCommand } from '../../application/canvas-workspace';
import { asId } from '../../domain/id-cast';
import type { NodeId } from '../../domain/ids';
import type { ProjectedView } from '../../domain/project-view';
import type { DiagramRecord } from '../../domain/records';
import { describeSelection, type InspectPanelProps } from './inspect-panel';

const NODES = {
  // `rootGroupId` looks for the parentless `group`, which is what every migrated diagram has as
  // its outer container; the trail hides it because the record's own name already says it.
  root: {
    id: asId<NodeId>('root'), kind: 'group' as const, label: 'A diagram', interfaceIds: [], typeIds: [],
  },
  broker: {
    id: asId<NodeId>('broker'),
    kind: 'module' as const,
    label: 'Session broker',
    description: 'acquire / release',
    parentId: asId<NodeId>('root'),
    interfaceIds: [],
    typeIds: [],
  },
  timeline: {
    id: asId<NodeId>('timeline'),
    kind: 'timeline' as const,
    label: 'Session history',
    parentId: asId<NodeId>('root'),
    interfaceIds: [],
    typeIds: [],
    steps: [{ id: 'turn-1', label: 'Forked turn', fork: 'session-child' }],
  },
};

const record = {
  name: 'A diagram',
  revision: 7,
  nodes: NODES,
  interfaces: {},
  types: {},
  wires: {},
  layouts: {},
  views: {},
  activeViewId: 'v',
} as unknown as DiagramRecord;

const view = { nodes: Object.values(NODES), wires: [], collapsedNodeIds: [] } as unknown as ProjectedView;

function props(overrides: Partial<InspectPanelProps> = {}): InspectPanelProps {
  return {
    record,
    view,
    selection: { kind: 'node', id: 'broker' },
    execute: () => {},
    executeAll: () => {},
    clearSelection: () => {},
    select: () => {},
    editable: true,
    diagrams: [],
    openDiagram: () => {},
    isSectionOpen: () => true,
    toggleSection: () => {},
    ...overrides,
  };
}

/**
 * The shape of one selection.
 *
 * Every assertion here is a thing the panel used to say twice or say pointlessly: the name in
 * the header and again in a field, the parent in the trail and again in the meta line, a count
 * of objects the canvas was already showing.
 */
describe('inspection shape', () => {
  it('names the object once, in the title, and makes that title the field', () => {
    const inspection = describeSelection(props());
    expect(inspection.title).toBe('Session broker');
    expect(inspection.rename).toBeTypeOf('function');
  });

  it('carries no meta line, because the trail already says where the object lives', () => {
    const inspection = describeSelection(props());
    expect(inspection.meta).toBe('');
    expect(inspection.trail.map((step) => step.label)).toEqual(['A diagram', 'Session broker']);
  });

  it('offers the registered presentation section alongside the existing node sections', () => {
    expect(describeSelection(props()).sections).toEqual([
      'description', 'box', 'interfaces', 'placement',
    ]);
  });

  it('keeps deleting out of the body and out of a read-only session', () => {
    expect(describeSelection(props()).remove?.label).toBe('Delete object');
    expect(describeSelection(props({ editable: false })).remove).toBeUndefined();
  });

  it('shows nothing, and no sections, when nothing is selected', () => {
    const inspection = describeSelection(props({ selection: null }));
    expect(inspection.sections).toEqual([]);
    expect(inspection.meta).toBe('');
  });

  it('the diagram itself renames through the header, keeping the root frame caption in step', () => {
    const batches: RecordCommand[][] = [];
    const inspection = describeSelection(props({
      selection: null,
      executeAll: (commands) => batches.push(commands),
    }));
    expect(inspection.rename).toBeTypeOf('function');
    inspection.rename?.('Agent Messaging');
    expect(batches).toEqual([[
      { kind: 'diagram.rename', name: 'Agent Messaging' },
      { kind: 'node.update', id: 'root', patch: { label: 'Agent Messaging' } },
    ]]);
  });

  it('Component item inspection', () => {
    const inspection = describeSelection(props({
      selection: { kind: 'component-item', nodeId: 'timeline', collection: 'steps', itemId: 'turn-1' },
    }));
    expect(inspection.kind).toBe('timeline step');
    expect(inspection.title).toBe('Forked turn');
    expect(inspection.sections).toEqual(['details']);
    expect(inspection.trail.map((item) => item.label)).toEqual([
      'A diagram', 'Session history', 'Forked turn',
    ]);
  });
});
