import { useStore } from '../../app/store';
import type { ObjectRecord } from '../../object-graph/contract';
import { roomFor } from '../../room-navigation/room-for';
import { createMission } from './create-mission';
import type { MissionsDesignCommands, MissionsDesignData } from './missions-design';
import { resolveMissionsDesign } from './missions-design-registry';

/** Composition root that supplies app state and host commands to a Mission List design. */
export function Missions() {
  const { graph, selected, elected, select, addRecord, enterRoom } = useStore();
  const design = resolveMissionsDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const data: MissionsDesignData = {
    graph,
    missions: graph.byKind('mission'),
    projects: graph.byKind('project'),
    templates: graph.byKind('missionTemplate'),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: MissionsDesignCommands = {
    select: (mission) => select(mission?.id ?? null),
    open: (mission) => {
      const room = roomFor(mission);
      if (room) enterRoom(room);
    },
    create: (input) => createMission(input, {
      graph,
      addRecord,
      select,
      enterRoom,
    }),
  };

  return <DesignView data={data} commands={commands} />;
}
