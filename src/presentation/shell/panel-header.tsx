import type { ReactNode } from 'react';

/**
 * The one header every panel wears.
 *
 * Chris's complaint was that the right panel changed shape for every option. The cure is that
 * nothing here is optional structure: a kind tag, a title, one meta line, and a trailing action
 * cluster are always laid out the same way. Only the words change.
 */
export interface PanelHeaderProps {
  /** Short uppercase category — what sort of thing this panel is showing. */
  kind: string;
  title: string;
  /** One quiet line of context under the title; kept to a line so the block never grows. */
  meta?: string;
  actions?: ReactNode;
  /** The path back, drawn above the title. Omitted, or a single step, draws nothing. */
  trail?: ReactNode;
  /**
   * Makes the title itself the field that renames it.
   *
   * A header that shows a name and a body that shows the same name in a labelled input is the
   * same fact twice, and the labelled one always won because it was the one you could type in.
   * Editing where the name already is removes the duplicate without removing the ability.
   */
  rename?: (label: string) => void;
}

export function PanelHeader({ actions, kind, meta, rename, title, trail }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-identity">
        {trail}
        <span className="panel-kind">{kind}</span>
        {rename ? (
          <input
            aria-label="Name"
            className="panel-title panel-title-field"
            onChange={(event) => rename(event.target.value)}
            title={title}
            value={title}
          />
        ) : <h2 className="panel-title" title={title}>{title}</h2>}
        {meta ? <span className="panel-meta">{meta}</span> : null}
      </div>
      <div className="panel-actions">{actions}</div>
    </header>
  );
}

/** A quiet square control. The glyph carries the meaning; the label carries it to a reader. */
export function IconButton({
  glyph, label, onClick, pressed, tone,
}: {
  glyph: string;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  tone?: 'quiet' | 'accent';
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="icon-button"
      data-tone={tone}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
