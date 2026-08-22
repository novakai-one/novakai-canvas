/** Shared input contract for node and wire projection. */

import type { RecordCommand } from '../application/canvas-workspace';
import type { CanvasPreferences, Selection } from '../domain/model';
import type { ProjectedView } from '../domain/project-view';
import type { DiagramRecord } from '../domain/records';

/** Everything the React Flow projection reads. */
export interface ProjectionInput {
  view: ProjectedView;
  record: DiagramRecord;
  preferences: CanvasPreferences;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
  /** Executes record changes; omitted by read-only hosts. */
  execute?: (command: RecordCommand) => void;
  /** Commits the accumulated frame when a resize gesture ends. */
  resizeEnd?: (id: string) => void;
}
