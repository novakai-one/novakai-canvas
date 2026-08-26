import { createDiagramRecordSchema } from '../../contract/schemas/diagram.ts';
import { libraryIndexSchema } from '../../contract/schemas/library.ts';
import { validateRecordIntegrity } from './record-integrity.ts';

/** Runtime validator for one independently stored diagram record. */
export const diagramRecordSchema = createDiagramRecordSchema(validateRecordIntegrity);
export { libraryIndexSchema };
