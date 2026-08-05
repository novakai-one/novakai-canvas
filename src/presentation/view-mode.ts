/**
 * Transient canvas mode. Chrome only — neither value changes an arrangement.
 *
 * Editing is the default. This is a tool for making diagrams, so opening it read-only put the
 * drawing controls one click behind a mode toggle and made the first requirement — "create
 * diagrams on the canvas" — the hidden state.
 */
export type CanvasMode = 'present' | 'edit';

export const DEFAULT_CANVAS_MODE: CanvasMode = 'edit';
