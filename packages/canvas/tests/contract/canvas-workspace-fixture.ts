import { parseArchitectureDocument } from '@novakai/canvas';
import { migrateDocumentToLibrary } from '@novakai/canvas';
import {
  createCanvasWorkspace, isSignatureName, type ActorContext, type RecordCommand,
} from '@novakai/canvas';
import type { DiagramRecord } from '@novakai/canvas';
import working from '../fixtures/migration/real-v2-working-copy.json' with { type: 'json' };

export const human: ActorContext = {
  actor: { id: 'local-user', kind: 'human' },
  provenance: { source: 'ui' },
};

export function openMessagingScope(): DiagramRecord {
  const library = migrateDocumentToLibrary(parseArchitectureDocument(working as unknown));
  return library.records['messaging-scope'];
}

export function batch(commands: RecordCommand[], expectedRevision: number, operationId = 'op-1') {
  return { operationId, expectedRevision, timestamp: '2026-08-06T00:00:00.000Z', commands };
}


export {
  createCanvasWorkspace,
  isSignatureName,
  migrateDocumentToLibrary,
  parseArchitectureDocument,
  working,
};
export type { ActorContext, RecordCommand, DiagramRecord };
