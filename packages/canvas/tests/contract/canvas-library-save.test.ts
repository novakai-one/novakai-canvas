import { describe, expect, it } from 'vitest';
import {
  createCanvasLibrary,
  createMemoryLibraryRepository,
  human,
  migrateDocumentToLibrary,
  openRacingLibrary,
  openWorkspace,
  parseArchitectureDocument,
  working,
} from './canvas-library-fixture.ts';

describe('save integrity', () => {
  it('reports failure when the record saved but the index commit is refused', async () => {
    const { library, repository, race } = openRacingLibrary();
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Agent Messaging (edited)' });
    // The first commit and the one retry both lose the race.
    race.indexConflicts = 2;

    const outcome = await library.save('messaging-scope');

    // The record landed but the entry did not, so "written" would be a lie the dropdown
    // then contradicts: the file holds the edit while the index still lists the old name.
    expect(outcome).toMatchObject({ status: 'save-failed' });
    expect((await repository.readDiagram('messaging-scope')).name).toBe('Agent Messaging (edited)');
    expect(library.list().find((entry) => entry.id === 'messaging-scope')?.name)
      .toBe('Agent Messaging');
  });

  it('retries the index commit once against the freshly read index', async () => {
    const { library, race } = openRacingLibrary();
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Agent Messaging (edited)' });
    race.indexConflicts = 1;

    expect(await library.save('messaging-scope')).toMatchObject({ status: 'written' });
    expect(library.list().find((entry) => entry.id === 'messaging-scope')?.name)
      .toBe('Agent Messaging (edited)');
  });

  it('recovers the index entry on the next save without rewriting the record', async () => {
    const { library, race, writes } = openRacingLibrary();
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Agent Messaging (edited)' });
    race.indexConflicts = 2;
    await library.save('messaging-scope');
    const writesAfterTornSave = writes.diagrams;

    // No new edit: the record is already on disk, so only the owed index entry is written.
    const outcome = await library.save('messaging-scope');

    expect(outcome).toMatchObject({ status: 'written' });
    expect(writes.diagrams).toBe(writesAfterTornSave);
    const entry = library.list().find((listed) => listed.id === 'messaging-scope');
    expect(entry?.name).toBe('Agent Messaging (edited)');
    expect(entry?.revision).toBe(workspace.snapshot().revision);
  });

  it('heals an index entry the disk already left behind the record', async () => {
    // The torn state the bug left behind: the record's revision moved past the entry's, and
    // expecting against the entry made every later save conflict forever.
    const migrated = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
    const torn = structuredClone(migrated);
    torn.records['messaging-scope'].revision += 5;
    const repository = createMemoryLibraryRepository(torn, {});
    const library = createCanvasLibrary(repository, torn.index, human);
    const workspace = await openWorkspace(library, 'messaging-scope');
    workspace.execute({ kind: 'diagram.rename', name: 'Agent Messaging (healed)' });

    expect(await library.save('messaging-scope')).toMatchObject({ status: 'written' });
    const entry = library.list().find((listed) => listed.id === 'messaging-scope');
    expect(entry?.name).toBe('Agent Messaging (healed)');
    expect(entry?.revision).toBe(workspace.snapshot().revision);
  });

  it('still refuses to overwrite a record another host changed', async () => {
    const { library, repository } = openRacingLibrary();
    const workspace = await openWorkspace(library, 'messaging-scope');
    const external = await repository.readDiagram('messaging-scope');
    await repository.writeDiagram(
      { ...external, name: 'Changed elsewhere', revision: external.revision + 1 },
      external.revision,
    );
    workspace.execute({ kind: 'diagram.rename', name: 'My edit' });

    expect(await library.save('messaging-scope')).toMatchObject({ status: 'stale-revision' });
    // The conflict is surfaced, never retried into an overwrite.
    expect(await library.save('messaging-scope')).toMatchObject({ status: 'stale-revision' });
    expect((await repository.readDiagram('messaging-scope')).name).toBe('Changed elsewhere');
  });
});
