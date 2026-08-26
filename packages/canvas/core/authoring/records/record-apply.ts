/** Writes compiled DSL into diagram records: one scope block, one record, one change set. */

import type { CanvasLibrary } from '../../../contract/library.ts';
import type { CanvasLibraryRepository } from '../../../contract/ports/library-repository.ts';
import type { CompiledDiagram } from '../compile.ts';
import { commandsFor } from './record-operations.ts';
import { recordForCompiled } from './record-target.ts';

/** What applying one scope block did to its record. */
export interface ApplyOutcome {
  diagramId: string;
  name: string;
  /** `unchanged` means the DSL described exactly what was already stored; nothing was written. */
  status: 'applied' | 'duplicate' | 'unchanged';
  revision: number;
  created: boolean;
}

/** Why one scope block could not be applied. Every failure is named, none are exceptions. */
export interface ApplyFailure {
  diagramId: string;
  reason: string;
}

/** Everything applying a scope block needs: the library for identity, the repository for content. */
export interface ApplyContext {
  library: CanvasLibrary;
  repository: CanvasLibraryRepository;
  operationId: string;
  timestamp: string;
}

/**
 * Applies one compiled scope block to its record as a single change set.
 *
 * The workspace remains the authority for revision, authorship and idempotency; the write that
 * follows carries its snapshot verbatim. Methods, types and layout presentation travel through
 * typed commands and therefore participate in the same atomic revision and undo history.
 */
export async function applyCompiledDiagram(
  context: ApplyContext,
  compiled: CompiledDiagram,
): Promise<ApplyOutcome | ApplyFailure> {
  const { library, repository } = context;
  let created = false;
  if (!library.index().entries[compiled.id]) {
    const outcome = await library.create(compiled.name, compiled.id);
    if (!('nodeLabels' in outcome)) {
      return { diagramId: compiled.id, reason: `could not create: ${outcome.status}` };
    }
    created = true;
  }

  const workspace = await library.open(compiled.id);
  if (!('snapshot' in workspace)) {
    return { diagramId: compiled.id, reason: `could not open: ${workspace.status}` };
  }

  const before = workspace.snapshot();
  const target = recordForCompiled(before, compiled);
  const commands = commandsFor(before, target);
  if (commands.length === 0) {
    return {
      diagramId: compiled.id, name: compiled.name, status: 'unchanged', revision: before.revision, created,
    };
  }

  const outcome = workspace.submit({
    operationId: context.operationId,
    expectedRevision: before.revision,
    timestamp: context.timestamp,
    commands,
  });
  if (outcome.status === 'rejected') {
    return { diagramId: compiled.id, reason: `${outcome.reason} (command ${outcome.commandIndex ?? '?'})` };
  }
  if (outcome.status === 'conflict') {
    return { diagramId: compiled.id, reason: `revision conflict: expected ${outcome.expectedRevision}, found ${outcome.actualRevision}` };
  }
  if (outcome.status === 'duplicate') {
    return {
      diagramId: compiled.id, name: compiled.name, status: 'duplicate', revision: outcome.revision, created,
    };
  }

  const written = await repository.writeDiagram(workspace.snapshot(), before.revision);
  if (written.status !== 'written') {
    return { diagramId: compiled.id, reason: `save ${written.status}` };
  }
  return {
    diagramId: compiled.id, name: compiled.name, status: 'applied', revision: written.revision, created,
  };
}

export { commandsFor, findNodeByLabel, removalCommandsFor } from './record-operations.ts';
export { blankRecord, recordForCompiled } from './record-target.ts';
