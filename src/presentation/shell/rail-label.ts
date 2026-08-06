/**
 * How much of a name is protected from truncation.
 *
 * Long enough to tell four "Mission Control UX 22-Jul — …" rows apart, short enough that the
 * head still shows what family a diagram belongs to at the rail's minimum width.
 */
const TAIL_LENGTH = 16;

/** The end of a name, which is the part that distinguishes it from its siblings. */
export function tail(label: string): string {
  return label.length <= TAIL_LENGTH ? label : label.slice(-TAIL_LENGTH);
}

/** The start of a name, which is what gives way when there is not enough room. */
export function head(label: string): string {
  return label.length <= TAIL_LENGTH ? '' : label.slice(0, -TAIL_LENGTH);
}

/** Beyond this a search result stops being a name and starts being a paragraph. */
const MAX_RESULT_LABEL = 48;

/**
 * One line, whatever the label really is.
 *
 * A comment's body is a node label like any other, so searching the library returned four-line
 * paragraphs as navigation rows — the single loudest thing in the old rail. A result row
 * answers "which one"; the object itself is where the prose belongs.
 */
export function oneLine(label: string, limit = MAX_RESULT_LABEL): string {
  const flattened = label.replace(/\s+/g, ' ').trim();
  return flattened.length > limit ? `${flattened.slice(0, limit - 1)}…` : flattened;
}
