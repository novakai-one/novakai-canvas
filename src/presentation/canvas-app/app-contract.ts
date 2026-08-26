import type {
  CanvasLibrary,
  CanvasPreferences,
  CanvasWorkspace,
  DiagramExportService,
  JsonRepository,
} from '@novakai/canvas';

/** What the host hands the app once the library and the first diagram have been read. */
export interface AppProps {
  library: CanvasLibrary;
  initialDiagramId: string;
  initialWorkspace: CanvasWorkspace;
  initialPreferences: CanvasPreferences;
  preferencesRepository: JsonRepository<CanvasPreferences>;
  diagramExporter: DiagramExportService;
  /** Lets an embedding host remember navigation without retaining the Canvas render tree. */
  onActiveDiagramChange?: (diagramId: string) => void;
}

/** One open diagram: its identity and the workspace holding its content. */
export interface OpenDiagram {
  id: string;
  workspace: CanvasWorkspace;
}
