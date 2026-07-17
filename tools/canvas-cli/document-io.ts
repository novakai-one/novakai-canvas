/** Validated, atomic persistence for the architecture document. */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { architectureDocumentSchema } from '../../src/domain/schema.ts';
import type { ArchitectureDocument } from '../../src/domain/model';

export async function loadDocument(path: string): Promise<ArchitectureDocument> {
  return architectureDocumentSchema.parse(JSON.parse(await readFile(path, 'utf8'))) as ArchitectureDocument;
}

/** Validates, bumps revision, writes atomically (temp + rename). Returns the new revision. */
export async function saveDocument(path: string, doc: ArchitectureDocument): Promise<number> {
  const next = architectureDocumentSchema.parse({ ...doc, revision: doc.revision + 1 });
  const temp = join(dirname(path), `.project-architecture-${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temp, path);
  return next.revision;
}
