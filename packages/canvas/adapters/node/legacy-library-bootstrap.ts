import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  migrateDocumentToLibrary,
  parseArchitectureDocument,
  type MigrationReport,
} from '../../contract/index.ts';

/** Result of checking whether the one-time legacy-to-library migration ran. */
export type BootstrapOutcome = { migrated: false } | { migrated: true; report: MigrationReport };

/** Migrates the legacy architecture document exactly once for a data directory. */
export async function bootstrapLibrary(dataDir: string): Promise<BootstrapOutcome> {
  const libraryPath = join(dataDir, 'library.json');
  const legacyPath = join(dataDir, 'project-architecture.json');
  if (existsSync(libraryPath) || !existsSync(legacyPath)) return { migrated: false };

  const document = parseArchitectureDocument(JSON.parse(await readFile(legacyPath, 'utf8')));
  const { index, records, report } = migrateDocumentToLibrary(document);
  const diagramsDir = join(dataDir, 'diagrams');
  await mkdir(diagramsDir, { recursive: true });
  await Promise.all(Object.values(records).map((record) =>
    writeFile(join(diagramsDir, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8')));
  await writeFile(libraryPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await rename(legacyPath, join(dataDir, 'project-architecture.pre-v3.json'));
  return { migrated: true, report };
}
