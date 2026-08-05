import { describe, expect, it } from 'vitest';
import { parseArchitectureDocument } from '../domain/schema';
import { migrateDocumentToLibrary } from '../domain/migrate/v2-to-v3';
import { createMemoryLibraryRepository } from '../adapters/memory-library-repository';
import { createCanvasLibrary, type CanvasLibrary } from './canvas-library';
import type { ActorContext, CanvasWorkspace } from './canvas-workspace';
import working from '../domain/migrate/fixtures/real-v2-working-copy.json' with { type: 'json' };

const human: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

function openLibrary(controls?: { failReadsFor?: Set<string>; failWritesFor?: Set<string> }): {
  library: CanvasLibrary;
} {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  const repository = createMemoryLibraryRepository(migrated, controls ?? {});
  return { library: createCanvasLibrary(repository, migrated.index, human) };
}

async function openWorkspace(library: CanvasLibrary, id: string): Promise<CanvasWorkspace> {
  const opened = await library.open(id);
  if ('status' in opened) throw new Error(`could not open ${id}: ${opened.status}`);
  return opened;
}

describe('canvas library', () => {
  it('lists Chris\'s diagrams by name', () => {
    const { library } = openLibrary();
    const names = library.list().map((entry) => entry.name);
    expect(names).toContain('Agent Messaging');
    expect(names).toContain('Novakai IDE');
    expect(names).toHaveLength(18); // 17 originals plus Unfiled
  });

  it('finds a diagram by a node label while every record is unreadable', () => {
    // Search must be answerable from the index alone; if it had to open records to match a
    // node label, this repository would make every search throw.
    const { library } = openLibrary({ failReadsFor: new Set(['*']) });
    const everyRead = openLibrary({ failReadsFor: new Set(allDiagramIds()) }).library;

    expect(library.search('message router').map((entry) => entry.id)).toContain('messaging-scope');
    expect(everyRead.search('message router').map((entry) => entry.id)).toContain('messaging-scope');
  });

  it('opens one diagram while every other record is unreadable', async () => {
    const unreadable = new Set(['project-scope', 'browser-scope', 'command-overview']);
    const { library } = openLibrary({ failReadsFor: unreadable });

    const workspace = await openWorkspace(library, 'messaging-scope');

    expect(workspace.snapshot().name).toBe('Agent Messaging');
    await expect(library.open('project-scope')).rejects.toThrow('unreadable-record');
  });

  it('returns the same workspace when a diagram is opened twice', async () => {
    const { library } = openLibrary();
    const first = await openWorkspace(library, 'messaging-scope');
    const second = await openWorkspace(library, 'messaging-scope');
    expect(second).toBe(first);
  });

  it('persists an edit and refuses a write made against a stale revision', async () => {
    const { library } = openLibrary();
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Agent Messaging (edited)' });

    expect(await library.save('messaging-scope')).toMatchObject({ status: 'written' });
    expect(library.list().find((entry) => entry.id === 'messaging-scope')?.name)
      .toBe('Agent Messaging (edited)');
  });

  it('surfaces a save failure instead of losing the edit', async () => {
    const { library } = openLibrary({ failWritesFor: new Set(['messaging-scope']) });
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Never saved' });

    const outcome = await library.save('messaging-scope');

    expect(outcome).toMatchObject({ status: 'save-failed' });
    // The edit is still in memory: a failed save must not silently discard the user's work.
    expect(workspace.snapshot().name).toBe('Never saved');
  });

  it('refuses to archive a diagram another diagram links into', async () => {
    const { library } = openLibrary();
    const inbound = library.inboundLinks('messaging-scope');
    expect(inbound).toEqual(['session-agents']);

    const outcome = await library.setStatus('messaging-scope', 'archived');

    expect(outcome).toMatchObject({ status: 'inbound-links-exist', links: ['session-agents'] });
  });

  it('archives a diagram nothing links into, and hides it from the default list', async () => {
    const { library } = openLibrary();
    const outcome = await library.setStatus('webhook-relay', 'archived');

    expect(outcome).toMatchObject({ status: 'archived' });
    expect(library.list().map((entry) => entry.id)).not.toContain('webhook-relay');
    expect(library.list({ includeArchived: true }).map((entry) => entry.id)).toContain('webhook-relay');
  });

  it('creates a diagram with one layout and one view ready to draw on', async () => {
    const { library } = openLibrary();
    const created = await library.create('Sketch');
    expect(created).toMatchObject({ name: 'Sketch', status: 'active' });

    const workspace = await openWorkspace(library, 'sketch');
    const record = workspace.snapshot();
    expect(Object.keys(record.layouts)).toHaveLength(1);
    expect(record.views[record.activeViewId]).toBeDefined();
  });

  it('refuses to create a diagram whose ID is taken', async () => {
    const { library } = openLibrary();
    expect(await library.create('Agent Messaging', 'messaging-scope'))
      .toMatchObject({ status: 'diagram-already-exists' });
  });

  it('advances the index revision on every index change', async () => {
    const { library } = openLibrary();
    const before = library.index().revision;
    await library.create('Sketch');
    expect(library.index().revision).toBe(before + 1);
  });

  it('records and removes a relationship that crosses two diagrams', async () => {
    const { library } = openLibrary();
    const added = await library.addLink({
      id: 'browser-to-messaging' as never,
      kind: 'references',
      label: 'drives',
      source: { diagramId: 'browser-scope' as never, nodeId: 'bs-pool' as never },
      target: { diagramId: 'messaging-scope' as never, nodeId: 'msg-agents' as never },
    });

    expect(added).toMatchObject({ label: 'drives' });
    expect(library.inboundLinks('messaging-scope')).toContain('browser-to-messaging');
    expect(await library.removeLink('browser-to-messaging')).toBe(true);
    expect(library.inboundLinks('messaging-scope')).not.toContain('browser-to-messaging');
  });

  it('refuses a link to a diagram that does not exist', async () => {
    const { library } = openLibrary();
    expect(await library.addLink({
      id: 'nowhere' as never,
      kind: 'references',
      label: 'points at nothing',
      source: { diagramId: 'browser-scope' as never, nodeId: 'bs-pool' as never },
      target: { diagramId: 'no-such-diagram' as never, nodeId: 'x' as never },
    })).toMatchObject({ status: 'diagram-not-found', id: 'no-such-diagram' });
  });

  it('rebuilds a damaged index from the records, keeping links the index alone holds', async () => {
    const { library } = openLibrary();
    const linksBefore = Object.keys(library.index().links);
    const ledgerBefore = Object.keys(library.index().migratedOperations).length;

    const rebuilt = await library.rebuildIndex();

    expect(Object.keys(rebuilt.entries)).toHaveLength(18);
    expect(Object.keys(rebuilt.links)).toEqual(linksBefore);
    expect(Object.keys(rebuilt.migratedOperations)).toHaveLength(ledgerBefore);
  });
});

function allDiagramIds(): string[] {
  const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  return Object.keys(migrated.records);
}
