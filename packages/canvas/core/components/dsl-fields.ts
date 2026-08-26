export type ParsedAssignedFields = { valid: true; fields: Record<string, string> }
  | { valid: false; error: string; hint: string };

/** Parses closed `key=value` attributes after a DSL statement's keyword and label. */
export function parseAssignedFields(
  tokens: string[],
  allowed: readonly string[],
  grammar: string,
): ParsedAssignedFields {
  const result: Record<string, string> = {};
  for (let index = 2; index < tokens.length;) {
    const token = tokens[index];
    const equals = token.indexOf('=');
    if (equals < 1) return { valid: false, error: `unexpected "${token}"`, hint: grammar };
    const key = token.slice(0, equals);
    if (!allowed.includes(key)) return { valid: false, error: `unexpected "${token}"`, hint: grammar };
    if (key in result) return { valid: false, error: `repeated ${key}`, hint: grammar };
    const inline = token.slice(equals + 1);
    const value = inline || tokens[index + 1] || '';
    if (!value) return { valid: false, error: `${key} cannot be empty`, hint: grammar };
    result[key] = value;
    index += inline ? 1 : 2;
  }
  return { valid: true, fields: result };
}
