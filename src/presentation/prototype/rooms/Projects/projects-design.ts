import type { RoomDesign } from '../../designs/room-design';
import type { ObjectId, ObjectRecord } from '../../object-graph/contract';
import type { ObjectGraph } from '../../object-graph/graph';

/** User input accepted by the host when a Projects design creates a project. */
export type ProjectCreationInput = {
  readonly title: string;
};

/** User input accepted by the host when a Projects design drafts a mission inside a project. */
export type MissionDraftInput = {
  readonly title: string;
  readonly projectId: ObjectId;
};

/** Read-only project board state supplied to every Projects design. */
export type ProjectsDesignData = {
  readonly graph: ObjectGraph;
  readonly projects: readonly ObjectRecord[];
  readonly selected: ObjectRecord | null;
  readonly attentionSubjectId: ObjectId | null;
};

/** Host-owned operations available to every Projects design. */
export type ProjectsDesignCommands = {
  select(record: ObjectRecord | null): void;
  open(record: ObjectRecord): void;
  createProject(input: ProjectCreationInput): ObjectId;
  draftMission(input: MissionDraftInput): ObjectId;
};

/** The complete host contract for a Projects design. */
export type ProjectsDesignProps = {
  data: ProjectsDesignData;
  commands: ProjectsDesignCommands;
};

/** A disposable Projects design registered through the generic Room seam. */
export type ProjectsDesign = RoomDesign<ProjectsDesignProps>;
