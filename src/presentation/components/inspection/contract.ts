import type { ReactNode } from 'react';
import type { DiagramSummary } from '../../../application/canvas-library';
import type { RecordCommand } from '../../../application/canvas-workspace';
import type { Selection } from '../../../domain/model';
import type { ProjectedView } from '../../../domain/project-view';
import type { DiagramRecord } from '../../../domain/records';

/** Host capabilities available to every inspection body. */
export interface InspectPanelProps {
  record: DiagramRecord;
  view: ProjectedView;
  selection: Selection;
  execute: (command: RecordCommand) => void;
  executeAll: (commands: RecordCommand[]) => void;
  clearSelection: () => void;
  select: (selection: Selection) => void;
  jumpTo?: (selection: Selection) => void;
  editable: boolean;
  diagrams: DiagramSummary[];
  openDiagram: (diagramId: string) => void;
  addInterface?: (ownerId: string) => void;
  isSectionOpen: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
}

/** Header, navigation and body for one selected object. */
export interface Inspection {
  kind: string;
  title: string;
  meta: string;
  rename?: (label: string) => void;
  remove?: { label: string; run: () => void };
  sections: readonly string[];
  body: ReactNode;
  trail: Array<{ label: string; select: Selection }>;
}
