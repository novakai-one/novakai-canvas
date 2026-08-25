/** Apply, check and snapshot verbs. */

import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  createCanvasLibrary, diagramRecordSchema, type CrossDiagramLink, type DiagramRecord,
} from '../../src/canvas.ts';
import { compile } from './compile.ts';
import type { CliArgs } from './cli-args.ts';
import { diagramIdOrFail, fail, readStdinOr } from './cli-args.ts';
import { reconcileLinks } from './cli-links.ts';
import { parseDsl } from './dsl-parse.ts';
import {
  createDirectoryLibraryRepository, readAllRecords, type OpenedLibrary,
} from './library-io.ts';
import { applyCompiledDiagram, blankRecord, recordForCompiled } from './record-apply.ts';
import { renderRecordSvg } from './snapshot.ts';

/** Parses, compiles and atomically applies every declared scope. */
export async function runApply(opened: OpenedLibrary, args: CliArgs): Promise<void> {
  const source = readStdinOr(args.positional[0], 'apply needs DSL: pass a file, or pipe it in. See ./canvas help');
  const { scopes, errors: parseErrors } = parseDsl(source);
  if (scopes.length === 0 && parseErrors.length === 0) fail('no scopes found in the DSL. See ./canvas help');
  const records = await readAllRecords(opened.repository, opened.library);
  const compiled = compile(scopes, records, Object.values(opened.library.index().links));
  const allErrors = [
    ...parseErrors.map((error) => `line ${error.line}: ${error.message}\n  fix: ${error.hint}`),
    ...compiled.errors.map((error) => `${error.line ? `line ${error.line}: ` : ''}${error.message}\n  fix: ${error.hint}`),
  ];
  if (allErrors.length > 0) fail(`${allErrors.length} error(s), nothing written:\n${allErrors.join('\n')}`);
  for (const warning of compiled.warnings) process.stderr.write(`warning: ${warning}\n`);
  const operationId = args.operationId ?? `cli-apply-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const lines: string[] = [];
  const applied = new Set<string>();
  for (const diagram of compiled.diagrams) {
    const outcome = await applyCompiledDiagram(
      { library: opened.library, repository: opened.repository, operationId, timestamp }, diagram,
    );
    if (!('status' in outcome)) fail(`apply failed for ${outcome.diagramId}: ${outcome.reason}`);
    applied.add(outcome.diagramId);
    lines.push(`${outcome.status}: ${outcome.name} (revision ${outcome.revision})`);
  }
  const after = await readAllRecords(opened.repository, opened.library);
  const notes = await reconcileLinks(
    opened.library, after, applied, compiled.diagrams.flatMap((diagram) => diagram.crossDiagramWires),
  );
  for (const note of notes) process.stderr.write(`note: ${note}\n`);
  await opened.library.rebuildIndex();
  process.stdout.write(`${lines.join('\n')}\n`);
}

interface CheckError { line: number | null; reason: string; correction: string }

function writeInvalidCheck(errors: CheckError[]): void {
  process.stdout.write(`${JSON.stringify({ status: 'invalid', errors }, null, 2)}\n`);
  process.exitCode = 1;
}

/** Validates through production parse, compile, schema and layout without writing. */
export async function runCheck(args: CliArgs): Promise<void> {
  const source = readStdinOr(args.positional[0], 'check needs DSL: pass a file, or pipe it in. See ./canvas help');
  const parsed = parseDsl(source);
  const repository = createDirectoryLibraryRepository(args.dataDir);
  let records: Record<string, DiagramRecord>;
  let links: CrossDiagramLink[];
  try {
    const index = await repository.readIndex();
    const library = createCanvasLibrary(repository, index, {
      actor: { id: 'canvas-cli', kind: 'system' },
      provenance: { source: 'cli', sourceRef: args.positional[0] ?? 'stdin-check' },
    });
    records = await readAllRecords(repository, library);
    links = Object.values(index.links);
  } catch (error) {
    writeInvalidCheck([{
      line: null,
      reason: error instanceof Error ? error.message : String(error),
      correction: 'pass --file with a readable diagram-record data directory',
    }]);
    return;
  }
  const compiled = compile(parsed.scopes, records, links);
  const errors: CheckError[] = [
    ...parsed.errors.map((error) => ({
      line: error.line, reason: error.message, correction: error.hint,
    })),
    ...compiled.errors.map((error) => ({
      line: error.line ?? null, reason: error.message, correction: error.hint,
    })),
  ];
  if (parsed.scopes.length === 0 && parsed.errors.length === 0) {
    errors.push({ line: null, reason: 'no scopes found in the DSL', correction: 'declare scope "My System"' });
  }
  if (errors.length > 0) {
    writeInvalidCheck(errors);
    return;
  }
  try {
    const diagrams = compiled.diagrams.map((diagram) => {
      const before = records[diagram.id] ?? blankRecord(diagram.id, diagram.name);
      const laidOut = diagramRecordSchema.parse(recordForCompiled(before, diagram));
      return {
        id: diagram.id,
        name: diagram.name,
        nodes: Object.keys(laidOut.nodes).filter((nodeId) => nodeId !== diagram.rootNodeId).length,
        wires: Object.keys(laidOut.wires).length + diagram.crossDiagramWires.length,
      };
    });
    process.stdout.write(`${JSON.stringify({ status: 'valid', diagrams, warnings: compiled.warnings }, null, 2)}\n`);
  } catch (error) {
    writeInvalidCheck([{
      line: null,
      reason: error instanceof Error ? error.message : String(error),
      correction: 'compare the DSL with ./canvas describe and correct the invalid component content',
    }]);
  }
}

/** Renders one stored map to SVG. */
export async function runSnapshot(opened: OpenedLibrary, args: CliArgs): Promise<void> {
  if (args.positional.length === 0) fail('snapshot needs a map: ./canvas snapshot <map> [-o out.svg]');
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);
  const record = await opened.repository.readDiagram(diagramId);
  const out = args.out ?? `${diagramId}.svg`;
  await writeFile(out, renderRecordSvg(record), 'utf8');
  process.stdout.write(`${out}\n`);
}
