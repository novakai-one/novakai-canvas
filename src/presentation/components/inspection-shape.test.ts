import { describe, expect, it } from 'vitest';
import { validateRecordCommand } from '@novakai/canvas';
import type { RecordCommand } from '@novakai/canvas';
import { componentFor } from '@novakai/canvas';
import { asId } from '@novakai/canvas';
import type { NodeId } from '@novakai/canvas';
import type { ProjectedView } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';
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
  block: {
    id: asId<NodeId>('block'), kind: 'block' as const, label: 'Required output',
    parentId: asId<NodeId>('root'), interfaceIds: [], typeIds: [], lines: ['Exactly one'],
  },
  entity: {
    id: asId<NodeId>('entity'), kind: 'entity' as const, label: 'Provider session',
    parentId: asId<NodeId>('root'), interfaceIds: [], typeIds: [], entityRef: 'provider-session',
    entityFields: [{ id: 'id', name: 'id', valueType: 'string', keys: ['pk' as const] }],
  },
  ooux: {
    id: asId<NodeId>('ooux'), kind: 'ooux-object' as const, label: 'Organization',
    parentId: asId<NodeId>('root'), interfaceIds: [], typeIds: [], objectRef: 'organization',
    oouxRows: [{
      kind: 'attribute' as const, id: 'name', name: 'name', valueType: 'string',
      role: 'core' as const, traits: [],
    }],
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
    expect(describeSelection(props({
      selection: { kind: 'node', id: 'block' },
    })).sections).toEqual(['description', 'content', 'text', 'box', 'placement']);
    expect(componentFor('block').contentEditors).toEqual([
      { field: 'lines', kind: 'string-list', label: 'Content', itemLabel: 'Line' },
    ]);
    expect(validateRecordCommand(record, {
      kind: 'node.content.set', id: 'block', field: 'lines', value: ['First', 'Second'],
    })).toEqual({ valid: true });
    expect(validateRecordCommand(record, {
      kind: 'node.content.set', id: 'block', field: 'lines', value: [''],
    })).toEqual({ valid: false, reason: 'invalid-node-content:block:lines' });
    expect(validateRecordCommand(record, {
      kind: 'node.content.set', id: 'block', field: 'wireRef', value: 'other-ref',
    })).toEqual({ valid: false, reason: 'node-content-not-editable:block:wireRef' });
    expect(describeSelection(props({
      selection: { kind: 'node', id: 'entity' },
    })).sections).toEqual(['description', 'content', 'box', 'placement']);
    expect(componentFor('entity').contentEditors?.[0]).toMatchObject({
      field: 'entityFields', kind: 'record-list', identity: { field: 'id', prefix: 'field' },
    });
    expect(componentFor('ooux-object').contentEditors?.[0]).toMatchObject({
      field: 'oouxRows', kind: 'record-list', discriminator: 'kind',
    });
    expect(validateRecordCommand(record, {
      kind: 'node.content.set', id: 'entity', field: 'entityFields',
      value: [{ id: 'provider', name: 'provider', valueType: 'string', keys: ['pk', 'fk'] }],
    })).toEqual({ valid: true });
    expect(validateRecordCommand(record, {
      kind: 'node.content.set', id: 'entity', field: 'entityFields',
      value: [{ id: 'provider', name: '', valueType: 'string', keys: [] }],
    })).toEqual({ valid: false, reason: 'invalid-node-content:entity:entityFields' });
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
