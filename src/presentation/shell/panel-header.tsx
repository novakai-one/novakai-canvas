import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * What a committed title edit becomes.
 *
 * Typing is a draft, so spaces and half-written words are fine mid-edit; the rules bite only
 * at commit: the name is trimmed, and an edit that trims to nothing — or to what was already
 * there — commits nothing at all, leaving the field to revert to the record's name.
 */
export function titleCommit(draft: string, title: string): string | null {
  const name = draft.trim();
  return name.length === 0 || name === title ? null : name;
}

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
  /** Focuses the title field once, text selected — used the moment a thing is born nameless. */
  focusTitle?: boolean;
}

export function PanelHeader({ actions, focusTitle, kind, meta, rename, title, trail }: PanelHeaderProps) {
  const titleField = useRef<HTMLInputElement | null>(null);
  /*
   * A local draft, committed on blur/Enter — the same shape NodeLabel and SignatureInput
   * already have. Feeding the record's name straight back per keystroke meant the rename's
   * trim ate trailing spaces as they were typed ("My Diagram" was untypeable) and an emptied
   * field snapped back before a new name could be written.
   */
  const [draft, setDraft] = useState<string | null>(null);
  /*
   * An effect, not an inline ref callback: an inline ref re-fires on every render, which would
   * re-select the text under the user's next keystroke. This fires when the flag turns true —
   * the parent spends it on the first commit, so the selection happens exactly once.
   */
  useEffect(() => {
    if (!focusTitle || !titleField.current) return;
    titleField.current.focus();
    titleField.current.select();
  }, [focusTitle]);
  const commitTitle = (): void => {
    if (draft === null) return;
    const name = titleCommit(draft, title);
    setDraft(null);
    if (name !== null) rename?.(name);
  };
  return (
    <header className="panel-header">
      <div className="panel-identity">
        {trail}
        <span className="panel-kind">{kind}</span>
        {rename ? (
          <input
            aria-label="Name"
            className="panel-title panel-title-field"
            onBlur={commitTitle}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTitle();
              if (event.key === 'Escape') setDraft(null);
            }}
            ref={titleField}
            title={title}
            value={draft ?? title}
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
