/** Why a library operation could not be completed. */
export type LibraryFailure =
  | { status: 'diagram-not-found'; id: string }
  | { status: 'diagram-already-exists'; id: string }
  | { status: 'inbound-links-exist'; links: string[] }
  | { status: 'link-not-found'; id: string }
  | { status: 'index-conflict'; actualRevision: number };

/** Distinguishes an unreadable document from a legitimate missing document. */
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
