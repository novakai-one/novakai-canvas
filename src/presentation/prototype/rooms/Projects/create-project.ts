import { makeRecord, sessionId } from '../../app/store';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ProjectCreationInput } from './projects-design';

type ProjectCreationEffects = {
  addRecord(record: ObjectRecord): void;
  select(id: ObjectId | null): void;
};

/** Creates a project record through the host's authoritative store seam. */
export function createProject(
  input: ProjectCreationInput,
  effects: ProjectCreationEffects,
): ObjectId {
  const title = input.title.trim() || 'New project';
  const projectId = sessionId('proj', title);
  const guessedPath = `~/Programming/${title.toLowerCase().replace(/\s+/g, '-')}`;

  effects.addRecord(makeRecord(projectId, 'project', title, {
    status: 'active',
    focus: 'Not written yet.',
    path: guessedPath,
    updated: new Date().toISOString(),
  }));

  effects.select(projectId);
  return projectId;
}
