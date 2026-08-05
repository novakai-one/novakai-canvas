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
}

export function PanelHeader({ actions, kind, meta, title }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-identity">
        <span className="panel-kind">{kind}</span>
        <h2 className="panel-title" title={title}>{title}</h2>
        <span className="panel-meta">{meta ?? ''}</span>
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
