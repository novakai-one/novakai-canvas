import { useStore } from '../../app/store';
import { roomFor } from '../../room-navigation/room-for';
import { createProject } from './create-project';
import { draftMission } from './draft-mission';
import type { ProjectsDesignCommands, ProjectsDesignData } from './projects-design';
import { resolveProjectsDesign } from './projects-design-registry';

/** Composition root that supplies app state and host commands to a Projects design. */
export function Projects() {
  const { graph, selected, elected, select, addRecord, enterRoom } = useStore();
  const design = resolveProjectsDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const data: ProjectsDesignData = {
    graph,
    projects: graph.byKind('project'),
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: ProjectsDesignCommands = {
    select: (record) => select(record?.id ?? null),
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
    createProject: (input) => createProject(input, { addRecord, select }),
    draftMission: (input) => draftMission(input, { graph, addRecord, select }),
  };

  return <DesignView data={data} commands={commands} />;
}
