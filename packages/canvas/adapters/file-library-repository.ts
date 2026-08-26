import type { CanvasLibraryRepository, WriteOutcome } from '../contract/ports/library-repository.ts';
import type { DiagramRecord, LibraryIndex } from '../contract/records/index.ts';
import { CanvasLoadError } from '../contract/errors.ts';

interface RuntimeParser<T> { parse(input: unknown): T; }

/** Fetches and JSON-decodes one endpoint, wrapping every failure mode in `CanvasLoadError`. */
async function fetchJson(endpoint: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    throw new CanvasLoadError(endpoint, error);
  }
  if (!response.ok) throw new CanvasLoadError(endpoint, `status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new CanvasLoadError(endpoint, error);
  }
}

/** Reads one endpoint and validates its body, never handing the caller unparsed JSON. */
async function readValidated<T>(endpoint: string, schema: RuntimeParser<T>): Promise<T> {
  const body = await fetchJson(endpoint);
  try {
    return schema.parse(body);
  } catch (error) {
    throw new CanvasLoadError(endpoint, error);
  }
}

/**
 * Reads the revision a 409 response reports, defensively.
 *
 * A stale write is a stale write even if the server sent no body or an unexpected shape: `-1`
 * signals "actual revision unknown" rather than fabricating a number the caller could mistake
 * for a real one, and rather than throwing where the interface promises an outcome.
 */
function actualRevisionFrom(body: unknown): number {
  if (body && typeof body === 'object') {
    const revision = (body as { revision?: unknown }).revision;
    if (typeof revision === 'number') return revision;
  }
  return -1;
}

/**
 * PUTs a validated value, carrying the revision it was read at.
 *
 * The expected revision travels as a query parameter rather than inside the JSON body, because
 * the body is specified to be exactly the record or index being written — wrapping it would
 * break that contract for every other reader of the same endpoint.
 */
async function writeValidated<T extends { revision: number }>(
  endpoint: string,
  schema: RuntimeParser<T>,
  value: T,
  expectedRevision: number,
): Promise<WriteOutcome> {
  const parsed = schema.parse(value);
  const url = `${endpoint}?expectedRevision=${expectedRevision}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    // Sent in the same readable form the store keeps, matching `http-json-repository`. The
    // bridge canonicalises whatever arrives, so this is for anyone reading the wire, not the
    // guarantee itself — the guarantee belongs to the writer of the file.
    body: `${JSON.stringify(parsed, null, 2)}\n`,
  });
  if (response.status === 409) {
    // The body may be missing or malformed; that is a terse conflict, not a reason to throw.
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: 'stale-revision', actualRevision: actualRevisionFrom(body) };
  }
  if (!response.ok) return { status: 'save-failed', reason: `status ${response.status}` };
  return { status: 'written', revision: parsed.revision };
}

/**
 * A repository backed by one HTTP endpoint per diagram record plus one for the library index.
 *
 * Records are addressed individually over the wire, mirroring the file-per-diagram storage on
 * the server: reading or writing one diagram never touches another's endpoint, so a corrupt or
 * unreachable record cannot take the rest of the library down with it.
 */
export function createFileLibraryRepository(
  base: string,
  schemas: { diagram: RuntimeParser<DiagramRecord>; library: RuntimeParser<LibraryIndex> },
): CanvasLibraryRepository {
  const indexEndpoint = `${base}/library`;
  const diagramsEndpoint = `${base}/diagrams`;
  const diagramEndpoint = (id: string): string => `${diagramsEndpoint}/${id}`;

  return {
    readIndex: () => readValidated(indexEndpoint, schemas.library),

    writeIndex: (index, expectedRevision) => writeValidated(
      indexEndpoint, schemas.library, index, expectedRevision,
    ),

    readDiagram: (id) => readValidated(diagramEndpoint(id), schemas.diagram),

    writeDiagram: (record, expectedRevision) => writeValidated(
      diagramEndpoint(record.id), schemas.diagram, record, expectedRevision,
    ),

    async deleteDiagram(id) {
      const endpoint = diagramEndpoint(id);
      let response: Response;
      try {
        response = await fetch(endpoint, { method: 'DELETE' });
      } catch (error) {
        throw new Error(`Unable to delete ${endpoint}: ${String(error)}`);
      }
      // A 404 means the record is already gone, which is the caller's desired end state, so
      // delete is treated as idempotent there. Any other failure is surfaced, never swallowed.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Unable to delete ${endpoint}: status ${response.status}`);
      }
    },

    async listDiagramIds() {
      const body = await fetchJson(diagramsEndpoint);
      if (!Array.isArray(body) || !body.every((item) => typeof item === 'string')) {
        throw new CanvasLoadError(diagramsEndpoint, 'expected an array of diagram ids');
      }
      return body as string[];
    },
  };
}
