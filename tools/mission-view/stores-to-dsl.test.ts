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
    const scopes = Object.values(doc.nodes).filter((node) => node.kind === 'scope' && !node.parentId);
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

  it('zones the object model into Stores and Read layer', () => {
    const doc = compiled();
    const byLabel = new Map(Object.values(doc.nodes).map((node) => [node.label, node]));
    const stores = byLabel.get('Stores');
    const readLayer = byLabel.get('Read layer');
    expect(stores?.kind).toBe('scope');
    expect(readLayer?.kind).toBe('scope');
    expect(byLabel.get('mission (missions.jsonl)')?.parentId).toBe(stores?.id);
    expect(byLabel.get('Mission Room')?.parentId).toBe(readLayer?.id);
  });

  it('nests the data tree by ownership with row facts preserved as descriptions', () => {
    const doc = compiled();
    // no tree node remains — zones carry the hierarchy (ruling R9)
    expect(Object.values(doc.nodes).some((node) => node.kind === 'tree')).toBe(false);
    // proj_command zones exist in two maps; scope lookups to the data tree
    const mapId = Object.values(doc.nodes).find((node) => node.label === 'Mission Data Tree')?.id;
    const descendantIds = new Set<string>();
    const queue = [mapId as string];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const node of Object.values(doc.nodes)) {
        if (node.parentId === current) {
          descendantIds.add(node.id);
          queue.push(node.id);
        }
      }
    }
    const byLabel = new Map(
      [...descendantIds].map((id) => [doc.nodes[id].label, doc.nodes[id]]),
    );
    const project = byLabel.get('proj_command');
    const missionDone = byLabel.get('mission_done');
    const taskLinked = byLabel.get('task_linked');
    expect(missionDone?.parentId).toBe(project?.id);
    expect(taskLinked?.parentId).toBe(missionDone?.id);
    // facts: status, outcome badge, team badge survive in descriptions
    expect(project?.description).toContain('status: active');
    expect(missionDone?.description).toContain('status: done');
    expect(missionDone?.description).toContain('outcome: present');
    expect(missionDone?.description).toContain('team: present');
    expect(byLabel.get('mission_live')?.description).toContain('outcome: absent');
    expect(taskLinked?.description).toContain('status: done');
    // orphans render in explicit standalone zones
    const noProject = byLabel.get('Standalone — no project');
    const noMission = byLabel.get('Standalone — no mission');
    expect(byLabel.get('mission_retired')?.parentId).toBe(noProject?.id);
    expect(byLabel.get('task_refiled-1')?.parentId).toBe(noMission?.id);
    expect(byLabel.get('task_refiled-2')?.parentId).toBe(noMission?.id);
    // containment wires: owns, parents above children
    const owns = Object.values(doc.wires).filter((wire) => wire.kind === 'owns');
    const pair = (wire: (typeof owns)[number]) =>
      `${doc.nodes[wire.source].label} -> ${doc.nodes[wire.target].label}`;
    expect(owns.map(pair)).toContain('proj_command -> mission_done');
    expect(owns.map(pair)).toContain('mission_done -> task_linked');
  });

  it('zones right-now by ownership; unmatched agents render standalone', () => {
    const doc = compiled();
    // mission_live and proj_command zones exist in two maps; scope lookups to right-now
    const mapId = Object.values(doc.nodes).find((node) => node.label === 'Mission Right Now')?.id;
    const descendantIds = new Set<string>();
    const queue = [mapId as string];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const node of Object.values(doc.nodes)) {
        if (node.parentId === current) {
          descendantIds.add(node.id);
          queue.push(node.id);
        }
      }
    }
    const byLabel = new Map(
      [...descendantIds].map((id) => [doc.nodes[id].label, doc.nodes[id]]),
    );
    const missionLive = byLabel.get('mission_live');
    // soft owner match earns containment: Manager sits inside its mission zone
    expect(byLabel.get('Manager Kimi Messaging')?.parentId).toBe(missionLive?.id);
    // mission_live refs proj_command, so the mission zone nests under the project zone
    expect(missionLive?.parentId).toBe(byLabel.get('proj_command')?.id);
    // unmatched running and mail-pulled exited agents go standalone
    const standalone = byLabel.get('Standalone — no mission link');
    expect(byLabel.get('Author Scribe')?.parentId).toBe(standalone?.id);
    expect(byLabel.get('Auditor Verity')?.parentId).toBe(standalone?.id);
  });

  it('canonical container is the first matching mission by sorted id (ruling R8)', () => {
    const stores = fixture();
    stores.missions = [
      { id: 'mission_b', title: 'B', status: 'in-progress', owner: 'Author Scribe', refs: [] },
      { id: 'mission_a', title: 'A', status: 'in-progress', owner: 'Author Scribe', refs: [] },
    ];
    stores.projects = [];
    const dsl = storesToDsl(stores);
    const { scopes, errors } = parseDsl(dsl);
    expect(errors).toEqual([]);
    const result = compile({
      schemaVersion: 1, id: 'doc', name: 'Doc', revision: 1,
      nodes: {}, interfaces: {}, types: {}, wires: {},
    }, scopes);
    expect(result.errors).toEqual([]);
    const byLabel = new Map(Object.values(result.doc.nodes).map((node) => [node.label, node]));
    // mission_a sorts first — it owns the agent; both missions soft-match so both
    // keep their mentions wires, but only mission_a owns the node.
    expect(byLabel.get('Author Scribe')?.parentId).toBe(byLabel.get('mission_a')?.id);
    const wirePairs = Object.values(result.doc.wires)
      .map((wire) => `${result.doc.nodes[wire.source].label} -> ${result.doc.nodes[wire.target].label} [${wire.kind}]`);
    expect(wirePairs).toContain('mission_a -> Author Scribe [owns]');
    expect(wirePairs).toContain('mission_b -> Author Scribe [mentions]');
    expect(wirePairs).not.toContain('mission_b -> Author Scribe [owns]');
  });

  it('classifies right-now edges: soft name match, missing link, mail thread with count', () => {
    const doc = compiled();
    const wires = Object.values(doc.wires).map((wire) => `${wire.label} [${wire.kind}]`);
    expect(wires).toContain('name match only (owner is a string) [mentions]');
    expect(wires).toContain('no link at all [missing]');
    expect(wires).toContain('mail thread (2x) [mentions]');
  });
});
