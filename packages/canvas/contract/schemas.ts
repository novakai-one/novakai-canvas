/** Contract-owned runtime validation building blocks for persisted Canvas data. */
export { createDiagramRecordSchema } from './schemas/diagram.ts';
export { libraryIndexSchema } from './schemas/library.ts';
export { architectureDocumentSchema, parseArchitectureDocument } from './schemas/legacy.ts';
export { canvasChangeSetSchema } from './schemas/change-set.ts';
export { canvasPreferencesSchema, WIRE_LABEL_SIZE_LIMITS } from './schemas/preferences.ts';
