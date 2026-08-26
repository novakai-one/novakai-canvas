import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from '@novakai/canvas';
import { censusOfLegacyDocument } from '@novakai/canvas';
import realV1 from '../../fixtures/migration/real-v1-committed.json' with { type: 'json' };
import realV2 from '../../fixtures/migration/real-v2-working-copy.json' with { type: 'json' };

/**
 * These fixtures are Chris's real diagrams, not invented data. The committed file is
 * schemaVersion 1; the working copy is the only schemaVersion 2 artefact that exists. Any
 * migration must survive both, so both are measured here before the migration is written.
 */
describe('real-data census', () => {
  const v1 = censusOfLegacyDocument(parseArchitectureDocument(realV1));
  const v2 = censusOfLegacyDocument(parseArchitectureDocument(realV2));

  it('measures identical meaning in both real input shapes', () => {
    expect(v1.diagramNames).toEqual(v2.diagramNames);
    expect(v1.nodeLabels).toEqual(v2.nodeLabels);
    expect(v1.wireSignatures).toEqual(v2.wireSignatures);
    expect(v1.interfaceSignatures).toEqual(v2.interfaceSignatures);
    expect(v1.typeIds).toEqual(v2.typeIds);
  });

  it('shows the working copy carries manual arrangement the committed file does not', () => {
    // Nine nodes sit in different places in Chris's working copy: arrangement he did by hand
    // in the app, which exists nowhere else. Losing that file loses that work, so the
    // migration is tested against it and not only against what git happens to hold.
    const moved = Object.keys(v2.placements).filter((id) => v1.placements[id] !== v2.placements[id]);
    expect(moved).toHaveLength(9);
    expect(Object.keys(v1.placements)).toEqual(Object.keys(v2.placements));
  });

  it('records the counts a migration must reproduce exactly', () => {
    expect(v2.diagramNames).toHaveLength(17);
    expect(v2.nodeLabels).toHaveLength(259);
    expect(v2.wireSignatures).toHaveLength(287);
    expect(v2.interfaceSignatures).toHaveLength(56);
    expect(v2.typeIds).toHaveLength(73);
    expect(Object.keys(v2.placements)).toHaveLength(259);
  });

  it('carries the idempotency history that only the working copy has', () => {
    expect(v1.appliedOperationIds).toHaveLength(0);
    expect(v2.appliedOperationIds).toHaveLength(60);
  });

  it('includes the cross-diagram wire that per-diagram records must find a home for', () => {
    expect(v2.wireSignatures).toContain('references|is a|session>msg-agents');
  });

  it('includes the three comment nodes that currently belong to no diagram', () => {
    expect(v2.nodeLabels).toContain('Project is the umbrella, not one enormous aggregate.');
    expect(v2.nodeLabels).toContain(
      'Sender decides delivery: normal queues into the turn; interrupt breaks it.',
    );
    expect(v2.nodeLabels.some((label) => label.startsWith('One session ⇢ one instance.'))).toBe(true);
  });
});
