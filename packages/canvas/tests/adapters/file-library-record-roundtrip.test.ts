import { describe, expect, it } from 'vitest';
import { diagramRecordSchema, migrateDocumentToLibrary, parseArchitectureDocument, working, sampleRecord } from './file-library-repository-fixture.ts';
import { fullyPopulatedRecord } from './fully-populated-record.ts';

describe('migrated record round-trip', () => {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));

  it('keeps missing presentation maps absent and rejects invalid stored presentation', () => {
    const withoutMaps = sampleRecord();
    const parsed = diagramRecordSchema.parse(JSON.parse(JSON.stringify(withoutMaps)));
    expect(parsed.layouts['layout-default'].appearanceByNodeId).toBeUndefined();
    expect(parsed.layouts['layout-default'].arrangementByContainerId).toBeUndefined();

    const invalidAppearance = JSON.parse(JSON.stringify(parsed));
    invalidAppearance.layouts['layout-default'].appearanceByNodeId = { root: { text: 'neon' } };
    expect(() => diagramRecordSchema.parse(invalidAppearance)).toThrow();

    const invalidArrangement = JSON.parse(JSON.stringify(parsed));
    invalidArrangement.layouts['layout-default'].arrangementByContainerId = { root: {
      layout: 'grid', columns: 7, gap: 16, align: 'stretch', childIds: [],
    } };
    expect(() => diagramRecordSchema.parse(invalidArrangement)).toThrow();
  });

  it('survives JSON round-trip and schema parse unchanged, for every migrated record', () => {
    const records = Object.values(migrated.records);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const roundTripped = diagramRecordSchema.parse(JSON.parse(JSON.stringify(record)));
      expect(roundTripped).toEqual(record);
    }
  });

  it('survives JSON round-trip for a hand-built record populating every optional field and union branch', () => {
    const record = fullyPopulatedRecord();
    const roundTripped = diagramRecordSchema.parse(JSON.parse(JSON.stringify(record)));
    expect(roundTripped).toEqual(record);
  });

  it('rejects component content stored on the wrong node kind', () => {
    const record = sampleRecord();
    const timelineInvalid = JSON.parse(JSON.stringify(record));
    timelineInvalid.nodes.module = {
      id: 'module', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      steps: [{ id: 'turn-1', label: 'Turn 1' }],
    };
    expect(() => diagramRecordSchema.parse(timelineInvalid)).toThrow();

    const metricInvalid = JSON.parse(JSON.stringify(record));
    metricInvalid.nodes.module = {
      id: 'module', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      value: '92%', detail: '12 of 13 runs', status: 'success',
    };
    expect(() => diagramRecordSchema.parse(metricInvalid)).toThrow();

    const iconCardInvalid = JSON.parse(JSON.stringify(record));
    iconCardInvalid.nodes.module = {
      id: 'module', kind: 'module', label: 'Module', description: 'Allowed base field',
      interfaceIds: [], typeIds: [], icon: 'check',
    };
    expect(() => diagramRecordSchema.parse(iconCardInvalid)).toThrow();

    const calloutInvalid = JSON.parse(JSON.stringify(record));
    calloutInvalid.nodes.module = {
      id: 'module', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      callouts: [{ id: 'evidence', kind: 'info', text: 'Evidence is complete' }],
    };
    expect(() => diagramRecordSchema.parse(calloutInvalid)).toThrow();

    const duplicateCallouts = JSON.parse(JSON.stringify(record));
    duplicateCallouts.nodes.stack = {
      id: 'stack', kind: 'callout-stack', label: 'Stack', interfaceIds: [], typeIds: [],
      callouts: [
        { id: 'same', kind: 'info', text: 'First' },
        { id: 'same', kind: 'warning', text: 'Second' },
      ],
    };
    expect(() => diagramRecordSchema.parse(duplicateCallouts)).toThrow();

    const oouxInvalid = JSON.parse(JSON.stringify(record));
    oouxInvalid.nodes.module = {
      id: 'module', kind: 'module', label: 'Module', interfaceIds: [], typeIds: [],
      objectRef: 'organization', oouxRows: [],
    };
    expect(() => diagramRecordSchema.parse(oouxInvalid)).toThrow();

    const cardinalityInvalid = JSON.parse(JSON.stringify(fullyPopulatedRecord()));
    cardinalityInvalid.wires[Object.keys(cardinalityInvalid.wires)[0]].source.cardinality = 'several';
    expect(() => diagramRecordSchema.parse(cardinalityInvalid)).toThrow();
  });
});
