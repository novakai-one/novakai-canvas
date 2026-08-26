/** Validated, atomic persistence for the architecture document. */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ArchitectureDocument } from '../../contract/records/legacy.ts';
import { architectureDocumentSchema } from '../../contract/schemas.ts';

export async function loadDocument(path: string): Promise<ArchitectureDocument> {
  return architectureDocumentSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}

/** Validates, bumps revision, writes atomically (temp + rename). Returns the new revision. */
export async function saveDocument(path: string, doc: ArchitectureDocument): Promise<number> {
  const next = architectureDocumentSchema.parse({ ...doc, revision: doc.revision + 1 });
  await writeDocument(path, next);
  return next.revision;
}

/** Persists a capability-owned revision exactly, without introducing a second revision writer. */
export async function writeDocument(path: string, doc: ArchitectureDocument): Promise<void> {
  const next = architectureDocumentSchema.parse(doc);
  const temp = join(dirname(path), `.project-architecture-${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temp, path);
}
