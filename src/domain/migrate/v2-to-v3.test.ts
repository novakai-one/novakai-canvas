import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from '../schema';
import { censusOfLegacyDocument, censusOfMigratedLibrary } from './census';
import { migrateDocumentToLibrary } from './v2-to-v3';
import committed from './fixtures/real-v1-committed.json' with { type: 'json' };
import mainCheckout from './fixtures/real-v1-main-checkout.json' with { type: 'json' };
import working from './fixtures/real-v2-working-copy.json' with { type: 'json' };

const fixtures = [
  { name: 'v1 committed (259 nodes)', raw: committed as unknown },
  { name: 'v1 main checkout (282 nodes, 19 scopes)', raw: mainCheckout as unknown },
  { name: 'v2 working copy (Chris\'s live arrangement)', raw: working as unknown },
];

/**
 * The migration is one-way and runs over diagrams that exist nowhere else. Every one of Chris's
 * real files is proven here, not a representative sample, because "representative" is how the
 * one file with the odd shape gets destroyed.
 */
describe.each(fixtures)('migrating $name', ({ raw }) => {
  const legacy = parseArchitectureDocument(raw);
  const before = censusOfLegacyDocument(legacy);
  const library = migrateDocumentToLibrary(legacy);
  const after = censusOfMigratedLibrary(library);

  it('loses no node', () => {
    expect(after.nodeLabels).toEqual(before.nodeLabels);
  });

  it('loses no relationship — a wire either stays a wire or becomes a library link', () => {
    expect([...after.wireSignatures, ...after.linkSignatures].sort())
      .toEqual(before.wireSignatures);
  });

  it('moves no node by a single pixel', () => {
    expect(after.placements).toEqual(before.placements);
  });

  it('loses no interface or type', () => {
    expect(after.interfaceSignatures).toEqual(before.interfaceSignatures);
    expect(after.typeIds).toEqual(before.typeIds);
  });

  it('carries the idempotency ledger so replayed operations stay recognised', () => {
    expect(after.appliedOperationIds).toEqual(before.appliedOperationIds);
  });

  it('keeps every original diagram and adds only Unfiled', () => {
    const added = after.diagramNames.filter((name) => !before.diagramNames.includes(name));
    expect(added).toEqual(['Unfiled']);
    for (const name of before.diagramNames) expect(after.diagramNames).toContain(name);
  });

  it('starts every record past the old global revision so stale expectations conflict', () => {
    expect(library.report.startingRevision).toBe(legacy.revision + 1);
    for (const record of Object.values(library.records)) {
      expect(record.revision).toBe(legacy.revision + 1);
    }
  });

  it('makes every record self-contained', () => {
    for (const record of Object.values(library.records)) {
      const ownNodeIds = new Set(Object.keys(record.nodes));
      for (const node of Object.values(record.nodes)) {
        if (node.parentId) expect(ownNodeIds.has(node.parentId)).toBe(true);
      }
      for (const wire of Object.values(record.wires)) {
        expect(ownNodeIds.has(wire.source.nodeId)).toBe(true);
        expect(ownNodeIds.has(wire.target.nodeId)).toBe(true);
      }
      for (const layout of Object.values(record.layouts)) {
        for (const placement of Object.values(layout.placements)) {
          expect(ownNodeIds.has(placement.nodeId)).toBe(true);
        }
      }
      expect(record.views[record.activeViewId]).toBeDefined();
      expect(record.layouts[record.views[record.activeViewId].layoutId]).toBeDefined();
    }
  });

  it('renames no concept silently — every scope becomes a group', () => {
    for (const record of Object.values(library.records)) {
      for (const node of Object.values(record.nodes)) {
        expect(node.kind).not.toBe('scope');
      }
    }
  });
});

describe('migration report', () => {
  const library = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));

  it('names the three nodes that belonged to no diagram', () => {
    expect(library.report.unfiledNodeIds.slice().sort())
      .toEqual(['note-browser', 'note-messaging', 'note-scope']);
  });

  it('names the relationship that crossed a diagram boundary', () => {
    expect(library.report.crossDiagramLinkIds).toEqual(['session-agents']);
    expect(library.index.links['session-agents']).toMatchObject({
      label: 'is a',
      source: { diagramId: 'project-scope', nodeId: 'session' },
      target: { diagramId: 'messaging-scope', nodeId: 'msg-agents' },
    });
  });

  it('carries all sixty pre-migration operations to the library', () => {
    expect(library.report.carriedOperationIds).toHaveLength(60);
    expect(library.index.migratedOperations).toHaveLength(60);
  });

  it('indexes every diagram for search without opening a record', () => {
    const entry = library.index.entries['messaging-scope'];
    expect(entry.name).toBe('Agent Messaging');
    expect(entry.nodeLabels).toContain('Message router');
  });
});
