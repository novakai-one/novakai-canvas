/**
 * Which Room an object opens into, or null when it only inspects.
 *
 * This is navigation policy, not presentation, so it lives beside the Room model rather
 * than inside a panel component — six surfaces need the answer and none of them should
 * have to import a component to get it.
 */
import type { Room } from '../app/store';
import { ENTERABLE_KINDS, type ObjectRecord } from '../object-graph/contract';

export function roomFor(record: ObjectRecord): Room | null {
  if (!ENTERABLE_KINDS.has(record.kind)) return null;
  switch (record.kind) {
    case 'mission':
      return { kind: 'mission', subjectId: record.id };
    case 'stage':
      return { kind: 'stage', subjectId: record.id };
    case 'project':
      return { kind: 'project', subjectId: record.id };
    case 'agent':
      return { kind: 'agent', subjectId: record.id };
    case 'agentRoleProfile':
      return { kind: 'role', subjectId: record.id };
    case 'thread':
      return { kind: 'thread', subjectId: record.id };
    default:
      return null;
  }
}
