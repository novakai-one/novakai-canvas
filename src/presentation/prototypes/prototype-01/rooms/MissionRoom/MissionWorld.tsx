import { useStore } from '../../app/store';
import type { ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';
import type {
  MissionWorldDesignCommands,
  MissionWorldDesignData,
} from './mission-world-design';
import { resolveMissionWorldDesign } from './mission-world-design-registry';

/** Composition root shared by Mission and Stage execution worlds. */
export function MissionWorld({
  subject,
  roots,
}: {
  subject: ObjectRecord;
  roots?: readonly ObjectRecord[];
}) {
  const {
    graph,
    selected,
    select,
    enterRoom,
    revealed,
    toggleReveal,
    elected,
  } = useStore();
  const design = resolveMissionWorldDesign(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const DesignView = design.View;

  const data: MissionWorldDesignData = {
    graph,
    subject,
    roots,
    selected,
    revealedStageIds: revealed,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: MissionWorldDesignCommands = {
    select,
    toggleReveal,
    openStage: (stageId) => enterRoom({ kind: 'stage', subjectId: stageId }),
    canOpen: (record) => roomFor(record) !== null,
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
  };

  return <DesignView data={data} commands={commands} />;
}
