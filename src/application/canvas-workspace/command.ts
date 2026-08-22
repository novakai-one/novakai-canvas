import type { DiagramRecord } from '../../domain/records.ts';
import { applyRecordCommand } from './command-application.ts';
import type { RecordCommand } from './contract.ts';
import { validateRecordCommand } from './command-validation.ts';

type CommandExecution =
  | { applied: true; record: DiagramRecord }
  | { applied: false; reason: string };

/** Validates then applies one command; a validation failure can never reach mutation. */
export function executeRecordCommand(
  record: DiagramRecord,
  command: RecordCommand,
): CommandExecution {
  const validation = validateRecordCommand(record, command);
  if (!validation.valid) return { applied: false, reason: validation.reason };
  try {
    return { applied: true, record: applyRecordCommand(record, command) };
  } catch (error) {
    return { applied: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
