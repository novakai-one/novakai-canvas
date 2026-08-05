import type { JsonRepository } from '../application/json-repository';

interface RuntimeParser<T> {
  parse(input: unknown): T;
}

/** Why a load failed, so a host can tell "nothing saved yet" from "your file is unreadable". */
export class CanvasLoadError extends Error {
  readonly endpoint: string;

  readonly cause: unknown;

  constructor(endpoint: string, cause: unknown) {
    super(`unreadable:${endpoint}`);
    this.name = 'CanvasLoadError';
    this.endpoint = endpoint;
    this.cause = cause;
  }
}

/**
 * Creates a validated HTTP-backed JSON repository.
 *
 * A missing document is a legitimate empty start and yields the fallback. A document that
 * exists but cannot be read or validated throws, and that distinction is the whole point:
 * treating a corrupt or unreachable file as "empty" hands the caller a blank document, and the
 * next autosave writes that blank document over the real one.
 */
export function createHttpJsonRepository<T>(
  endpoint: string,
  schema: RuntimeParser<T>,
  fallback: T,
): JsonRepository<T> {
  return {
    async load() {
      let response: Response;
      try {
        response = await fetch(endpoint);
      } catch (error) {
        throw new CanvasLoadError(endpoint, error);
      }
      if (response.status === 404) return fallback;
      if (!response.ok) throw new CanvasLoadError(endpoint, `status ${response.status}`);
      try {
        return schema.parse(await response.json());
      } catch (error) {
        throw new CanvasLoadError(endpoint, error);
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
