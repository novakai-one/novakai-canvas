/** Shared input contract for node and wire projection. */

import type { RecordCommand } from '@novakai/canvas';
import type { CanvasPreferences, ResolvedCanvasTheme, Selection } from '@novakai/canvas';
import type { ProjectedView } from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';

/** Everything the React Flow projection reads. */
export interface ProjectionInput {
  view: ProjectedView;
  record: DiagramRecord;
  preferences: CanvasPreferences;
  theme: ResolvedCanvasTheme;
  selection: Selection;
  editable: boolean;
  select: (selection: Selection) => void;
  /** Executes record changes; omitted by read-only hosts. */
  execute?: (command: RecordCommand) => void;
  /** Commits the accumulated frame when a resize gesture ends. */
  resizeEnd?: (id: string) => void;
}
