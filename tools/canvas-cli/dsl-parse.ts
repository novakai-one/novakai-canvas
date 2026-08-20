/** Line-oriented DSL parser. Collects every error and never throws. */

import type { ParseResult } from './dsl-ast.ts';
import { ParserState } from './dsl-parse/parser-state.ts';
import { parseLine } from './dsl-parse/statements.ts';

/** Parses DSL source into scope ASTs plus every error found. */
export function parseDsl(source: string): ParseResult {
  const state = new ParserState();
  const lines = source.split('\n');
  for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
    const line = lines[lineNumber - 1].trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    parseLine(state, line, lineNumber);
  }
  return state.finish(lines.length);
}
