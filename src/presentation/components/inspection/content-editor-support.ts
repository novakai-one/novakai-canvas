import type { RecordEditorField } from '@novakai/canvas';

/** One draft row of any collection editor, before validation. */
export type DraftRecord = Record<string, unknown>;

/** Shared by every collection editor: swap one item with its neighbour, bounds respected. */
export function moveItem(items: DraftRecord[], index: number, offset: -1 | 1): DraftRecord[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Shared by every collection editor: one declared field's value fails its own constraints. */
export function fieldInvalid(field: RecordEditorField, value: unknown): boolean {
  if (field.control === 'text') {
    if (value === undefined && !field.required) return false;
    return typeof value !== 'string' || (field.required && value.length === 0)
      || (field.maxLength !== undefined && value.length > field.maxLength);
  }
  if (field.control === 'select') {
    if ((value === undefined || value === '') && !field.required) return false;
    return typeof value !== 'string' || !field.values.includes(value);
  }
  return !Array.isArray(value) || new Set(value).size !== value.length
    || value.some((entry) => typeof entry !== 'string' || !field.values.includes(entry));
}
