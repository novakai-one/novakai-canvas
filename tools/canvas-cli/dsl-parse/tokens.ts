import type { InterfaceAst, TypeAst } from '../dsl-ast.ts';

/** Splits a line into tokens, treating double-quoted spans as single tokens. */
export function tokenize(line: string): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === '"') {
      const close = line.indexOf('"', index + 1);
      if (close === -1) return { tokens, error: 'unbalanced quote' };
      tokens.push(line.slice(index + 1, close));
      index = close + 1;
      continue;
    }
    let end = index;
    while (end < line.length && !/[\s"]/.test(line[end])) end += 1;
    tokens.push(line.slice(index, end));
    index = end;
  }
  return { tokens };
}

/** Parses one method signature line, or returns null when the grammar does not match. */
export function parseInterfaceLine(line: string): InterfaceAst | null {
  const match = /^([A-Za-z_][\w-]*)\(([^)]*)\)\s*->\s*(.+)$/.exec(line);
  if (!match) return null;
  const list = (raw: string): string[] =>
    raw.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
  return { name: match[1], accepts: list(match[2]), returns: list(match[3]) };
}

/** Parses one type declaration line, or returns null when the grammar does not match. */
export function parseTypeLine(line: string): TypeAst | null {
  const match = /^type\s+([A-Za-z_][\w-]*)\s*\{([^}]*)\}\s*$/.exec(line);
  if (!match) return null;
  return {
    name: match[1],
    fields: match[2].split(',').map((part) => part.trim()).filter((part) => part.length > 0),
  };
}

/** Returns the key before an equals sign when the token is an authored attribute. */
export function attributeKey(token: string): string | undefined {
  const equals = token.indexOf('=');
  return equals < 1 ? undefined : token.slice(0, equals);
}
