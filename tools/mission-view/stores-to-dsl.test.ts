import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../src/domain/model';
import { architectureDocumentSchema } from '../../src/domain/schema';
import { parseDsl } from '../canvas-cli/dsl-parse.ts';
import { compile } from '../canvas-cli/compile.ts';
import { rightNowSelection, storesToDsl, type MissionStores } from './stores-to-dsl.ts';

const NOW = '2026-07-22T12:00:00.000Z';
const RECENT = '2026-07-21T12:00:00.000Z';
const STALE = '2026-07-01T12:00:00.000Z';

/** Production-shaped: a large exited-agent tail dwarfing the running set. */
function fixture(): MissionStores {
  const historicalExits = Array.from({ length: 110 }, (_, index) => ({
    agentId: `agent_old-${index}`,
    title: `agent`,
    provider: 'claude',
    status: 'exited',
    archived: index % 2 === 0,
  }));
  return {
    projects: [
      { id: 'proj_command', title: 'Novakai Command', status: 'active' },
      { id: 'proj_docs', title: 'Novakai Docs', status: 'active' },
    ],
    missions: [
      {
        id: 'mission_live', title: 'Live one', status: 'in-progress',
        owner: 'manager-kimi-messaging',
        refs: [{ kind: 'project', value: 'proj_command' }],
      },
      {
        id: 'mission_done', title: 'Done one', status: 'done', outcome: 'shipped',
        team: ['Docs Render · opus'],
        refs: [{ kind: 'project', value: 'proj_command' }, { kind: 'objective', value: 'okr_ship' }],
      },
      { id: 'mission_retired', title: 'Old one', status: 'retired', refs: [] },
    ],
    tasks: [
      { id: 'task_linked', title: 'Linked', status: 'done', refs: [{ kind: 'mission', value: 'mission_done' }] },
      { id: 'task_refiled-1', title: 'Tombstone', status: 'refiled', refs: [] },
      { id: 'task_refiled-2', title: 'Tombstone', status: 'refiled', refs: [] },
    ],
    okrs: [{ id: 'okr_ship', title: 'Ship it' }],
    agents: [
      { agentId: 'agent_mgr', title: 'Manager Kimi Messaging', provider: 'kimi', status: 'running' },
      { agentId: 'agent_scribe', title: 'Author Scribe', provider: 'codex', status: 'running' },
      { agentId: 'agent_verity', title: 'Auditor Verity', provider: 'kimi', status: 'exited' },
      { agentId: 'agent_ghost', title: 'Silent Ghost', provider: 'codex', status: 'exited' },
      { agentId: 'agent_stale', title: 'Stale Mailer', provider: 'kimi', status: 'exited' },
      ...historicalExits,
    ],
    messages: [
      { from: 'Author Scribe', to: 'Auditor Verity', createdAt: RECENT },
      { from: 'Author Scribe', to: 'Auditor Verity', createdAt: RECENT },
      { from: 'Stale Mailer', to: 'Author Scribe', createdAt: STALE },
      { from: 'Manager Kimi Messaging', to: '#team', createdAt: RECENT },
      { from: 'Silent Ghost', to: 'Someone Unknown', createdAt: RECENT },
    ],
    now: NOW,
  };
}

function compiled(): ArchitectureDocument {
  const dsl = storesToDsl(fixture());
  const { scopes, errors } = parseDsl(dsl);
  expect(errors).toEqual([]);
  const result = compile({
    schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1,
    nodes: {}, interfaces: {}, types: {}, wires: {},
  }, scopes);
  expect(result.errors).toEqual([]);
  return result.doc;
}

describe('rightNowSelection', () => {
  it('includes exactly: in-progress missions, running agents, mail-linked recent exits', () => {
    const { missions, running, exited } = rightNowSelection(fixture());
    expect(missions.map((mission) => mission.id)).toEqual(['mission_live']);
    expect(running.map((entry) => entry.label)).toEqual(['Manager Kimi Messaging', 'Author Scribe']);
    // Verity: exited but mailed a running agent this week — in, per ruling.
    expect(exited.map((entry) => entry.label)).toEqual(['Auditor Verity']);
  });

  it('excludes by name: no-mail exits, stale mailers, unknown correspondents, the archived tail', () => {
    const dsl = storesToDsl(fixture());
    for (const absent of ['Silent Ghost', 'Stale Mailer', 'Someone Unknown', 'agent_old-0']) {
      expect(dsl).not.toContain(absent);
    }
  });
});

describe('storesToDsl', () => {
  it('emits three scopes that parse, compile, and validate cleanly', () => {
    const doc = compiled();
    const scopes = Object.values(doc.nodes).filter((node) => node.kind === 'scope');
    expect(scopes.map((scope) => scope.label).sort()).toEqual(
      ['Mission Data Tree', 'Mission Object Model', 'Mission Right Now'],
    );
    expect(() => architectureDocumentSchema.parse({
      ...doc,
      nodes: Object.fromEntries(Object.entries(doc.nodes).map(([id, node]) => [
        id, { ...node, size: { width: Math.max(1, node.size.width), height: Math.max(1, node.size.height) } },
      ])),
    })).not.toThrow();
  });

  it('computes object-model counts from the data, never copies them', () => {
    const dsl = storesToDsl(fixture());
    expect(dsl).toContain('typed ref (2x) [references]');            // mission→project
    expect(dsl).toContain('typed ref (1x) [references]');            // mission→objective
    expect(dsl).toContain('typed refs, sparse (1x) [references]');   // mission⇄task
    expect(dsl).toContain('outcome 1/3, stage 0/3, team 1/3');
  });

  it('builds the tree with orphan buckets, tombstones, and badges', () => {
    const doc = compiled();
    const tree = Object.values(doc.nodes).find((node) => node.kind === 'tree');
    expect(tree?.rows).toEqual([
      { id: 'proj_command', kind: 'project', status: 'active', badges: [] },
      { id: 'mission_live', kind: 'mission', status: 'in-progress', parentRowId: 'proj_command', badges: [] },
      { id: 'mission_done', kind: 'mission', status: 'done', parentRowId: 'proj_command', badges: ['outcome', 'team'] },
      { id: 'task_linked', kind: 'task', status: 'done', parentRowId: 'mission_done', badges: [] },
      { id: 'proj_docs', kind: 'project', status: 'active', badges: [] },
      { id: 'no-project', kind: 'bucket', badges: [], label: '(no project)' },
      { id: 'mission_retired', kind: 'mission', status: 'retired', parentRowId: 'no-project', badges: [] },
      { id: 'no-mission', kind: 'bucket', badges: [], label: '(no mission) 2 tasks' },
    ]);
  });

  it('classifies right-now edges: soft name match, missing link, mail thread with count', () => {
    const doc = compiled();
    const wires = Object.values(doc.wires).map((wire) => `${wire.label} [${wire.kind}]`);
    expect(wires).toContain('name match only (owner is a string) [mentions]');
    expect(wires).toContain('no link at all [missing]');
    expect(wires).toContain('mail thread (2x) [mentions]');
  });
});
