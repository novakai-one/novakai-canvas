import { slugify } from '../slug.ts';

/** Ranks nearby labels for an authored endpoint diagnostic. */
export function closestCandidates(labels: Map<string, string>, query: string): string[] {
  const querySlug = slugify(query);
  return [...labels.entries()]
    .map(([slug, label]) => {
      let score = 0;
      if (slug.includes(querySlug) || querySlug.includes(slug)) score = 2;
      else {
        let shared = 0;
        while (shared < Math.min(slug.length, querySlug.length)
          && slug[shared] === querySlug[shared]) shared += 1;
        score = shared / Math.max(slug.length, 1);
      }
      return { label, score };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((entry) => entry.label);
}
