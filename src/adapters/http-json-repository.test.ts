import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasLoadError, createHttpJsonRepository } from './http-json-repository';

const schema = { parse: (input: unknown) => input as { ok: boolean } };
const fallback = { ok: false };

function respondWith(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('http json repository', () => {
  it('treats a missing document as a legitimate empty start', async () => {
    respondWith(404, undefined);
    const repository = createHttpJsonRepository('/api/architecture', schema, fallback);
    expect(await repository.load()).toBe(fallback);
  });

  it('refuses to pretend an unreadable document is an empty one', async () => {
    // This is the dangerous case: returning the fallback here hands the caller a blank
    // document, and the autosave that follows writes it over the real file.
    respondWith(500, undefined);
    const repository = createHttpJsonRepository('/api/architecture', schema, fallback);
    await expect(repository.load()).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('refuses to pretend invalid content is an empty document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new SyntaxError('not json'); },
    }));
    const repository = createHttpJsonRepository('/api/architecture', {
      parse: () => { throw new Error('schema mismatch'); },
    }, fallback);
    await expect(repository.load()).rejects.toBeInstanceOf(CanvasLoadError);
  });

  it('reports a network failure rather than swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const repository = createHttpJsonRepository('/api/architecture', schema, fallback);
    await expect(repository.load()).rejects.toBeInstanceOf(CanvasLoadError);
  });
});
