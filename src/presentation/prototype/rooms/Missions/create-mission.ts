import { makeRecord, sessionId, type Room } from '../../app/store';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';
import type { MissionCreationInput } from './missions-design';

type MissionCreationEffects = {
  readonly graph: ObjectGraph;
  addRecord(record: ObjectRecord): void;
  select(id: ObjectId | null): void;
  enterRoom(room: Room): void;
};

function stageTitlesFrom(template: ObjectRecord | undefined): readonly string[] {
  const stageTitles = template?.fields.stageTitles;
  return Array.isArray(stageTitles)
    ? stageTitles.filter((title): title is string => typeof title === 'string')
    : [];
}

/** Creates a mission and its template stages through the host's authoritative store seam. */
export function createMission(
  input: MissionCreationInput,
  effects: MissionCreationEffects,
): ObjectId {
  const title = input.title.trim() || 'Untitled mission';
  const missionId = sessionId('mission', title);
  const template = input.templateId ? effects.graph.get(input.templateId) : undefined;
  const createdAt = new Date().toISOString();
  const refs = [
    { kind: 'project', value: input.projectId },
    ...(template ? [{ kind: 'template', value: template.id }] : []),
  ];

  effects.addRecord(makeRecord(
    missionId,
    'mission',
    title,
    {
      status: 'draft',
      priority: 'medium',
      owner: 'principal_chris',
      notes: input.notes.trim() || 'Created just now. No outcome written yet.',
      updated: createdAt,
    },
    refs,
  ));

  stageTitlesFrom(template).forEach((stageTitle, index) => {
    const stageId = `${missionId}_s${index + 1}`;
    effects.addRecord(makeRecord(stageId, 'stage', stageTitle, {
      stageId,
      missionId,
      parentStageId: null,
      order: index + 1,
      status: 'planned',
      condition: `${stageTitle} is agreed and written down.`,
    }));
  });

  effects.select(missionId);
  effects.enterRoom({ kind: 'mission', subjectId: missionId });
  return missionId;
}
