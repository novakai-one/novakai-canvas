import { makeRecord, sessionId } from '../../app/store';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import type { MissionDraftInput } from './projects-design';

type MissionDraftEffects = {
  readonly graph: ObjectGraph;
  addRecord(record: ObjectRecord): void;
  select(id: ObjectId | null): void;
};

/**
 * Drafts a mission attached to a project: draft fields only, no template stages.
 * The draft is selected so the inspector shows it, but the board keeps its place —
 * drafting is a board gesture, not a decision to leave the Room.
 */
export function draftMission(
  input: MissionDraftInput,
  effects: MissionDraftEffects,
): ObjectId {
  const title = input.title.trim() || 'New mission';
  const missionId = sessionId('mission', title);
  const projectTitle = effects.graph.get(input.projectId)?.title ?? 'this project';

  effects.addRecord(makeRecord(
    missionId,
    'mission',
    title,
    {
      status: 'draft',
      priority: 'medium',
      owner: 'principal_chris',
      notes: `Drafted from ${projectTitle}. Give it stages when you know the shape.`,
      updated: new Date().toISOString(),
    },
    [{ kind: 'project', value: input.projectId }],
  ));

  effects.select(missionId);
  return missionId;
}
