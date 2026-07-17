import type { z } from 'zod';
import type { JsonRepository } from '../application/json-repository';

/** Creates a validated HTTP-backed JSON repository. */
export function createHttpJsonRepository<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  fallback: T,
): JsonRepository<T> {
  return {
    async load() {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) return fallback;
        return schema.parse(await response.json());
      } catch {
        return fallback;
      }
    },
    async save(value) {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: `${JSON.stringify(schema.parse(value), null, 2)}\n`,
      });
      if (response.status === 409) throw new Error('stale-revision');
      if (!response.ok) throw new Error(`Unable to save ${endpoint}`);
    },
  };
}
