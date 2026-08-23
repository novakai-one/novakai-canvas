/** Atomic validation and application of a diagram's complete method/type dictionaries. */

import { diagramRecordSchema } from '../../domain/record-schema.ts';
import type { DiagramRecord } from '../../domain/records.ts';
import type { RecordCommand } from './contract.ts';

type DefinitionCommand = Extract<RecordCommand, { kind: 'diagram.definitions.replace' }>;

/** Rejects dictionaries that would leave the current candidate record inconsistent. */
export function validateDefinitionReplacement(
  record: DiagramRecord,
  command: DefinitionCommand,
): void {
  diagramRecordSchema.parse({
    ...record,
    interfaces: command.interfaces,
    types: command.types,
  });
}

/** Replaces both dictionaries together inside the workspace's uncommitted candidate. */
export function applyDefinitionReplacement(
  record: DiagramRecord,
  command: DefinitionCommand,
): void {
  record.interfaces = structuredClone(command.interfaces);
  record.types = structuredClone(command.types);
}
