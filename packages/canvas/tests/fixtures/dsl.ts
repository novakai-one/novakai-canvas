/** Builds laid-out diagram records straight from DSL, the way `./canvas apply` composes them. */

import {
  blankRecord,
  compile,
  parseDsl,
  recordForCompiled,
  type CompileResult,
  type DiagramRecord,
} from '@novakai/canvas';

/** The records one DSL source produces, plus everything the compiler had to say about it. */
export interface BuiltRecords {
  records: Record<string, DiagramRecord>;
  result: CompileResult;
  parseErrors: ReturnType<typeof parseDsl>['errors'];
}

/**
 * Compiles DSL into records without any storage in the way.
 *
 * The same two steps `./canvas apply` runs — compile, then lay out against what already exists —
 * minus the library, so a test can exercise the content path without a temp directory.
 */
export function buildRecords(
  source: string,
  existing: Record<string, DiagramRecord> = {},
): BuiltRecords {
  const { scopes, errors } = parseDsl(source);
  const result = compile(scopes, existing);
  const records: Record<string, DiagramRecord> = { ...existing };
  for (const compiled of result.diagrams) {
    records[compiled.id] = recordForCompiled(
      existing[compiled.id] ?? blankRecord(compiled.id, compiled.name),
      compiled,
    );
  }
  return { records, result, parseErrors: errors };
}

/** The single record a one-scope DSL source produces. */
export function buildRecord(
  source: string,
  existing: Record<string, DiagramRecord> = {},
): DiagramRecord {
  const built = buildRecords(source, existing);
  if (built.parseErrors.length > 0 || built.result.errors.length > 0) {
    throw new Error(`fixture DSL did not compile: ${JSON.stringify([built.parseErrors, built.result.errors])}`);
  }
  return built.records[built.result.diagrams[0].id];
}
