/** Derives a stable id from a human label: lowercase alnum runs joined by dashes. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 0)
    .join('-');
}
