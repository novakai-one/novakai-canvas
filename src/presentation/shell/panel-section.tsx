import type { ReactNode } from 'react';

/** What a panel needs to draw one titled group. */
export interface PanelSectionProps {
  title?: string;
  trailing?: ReactNode;
  /** Takes the leftover height of the body — for the one section that is a list. */
  fill?: boolean;
  /**
   * Accordion membership.
   *
   * A section with an id can be closed to its heading row; a section without one is always
   * open. Settings bodies stay always-open on purpose — they are short, and hiding a
   * preference behind a second click is the opposite of exposing it.
   */
  sectionId?: string;
  open?: boolean;
  onToggle?: (sectionId: string) => void;
  children: ReactNode;
}

/**
 * A titled group inside a panel body.
 *
 * Sections are the only way content enters a panel, so every panel body is a stack of the same
 * block at the same rhythm regardless of what is selected.
 *
 * The title sits *in* a hairline that runs to the panel's inner edge rather than above or below
 * a full-width rule. One line per group instead of two, and the grouping reads from the
 * `--space-6` gap before the rule is even noticed.
 */
export function PanelSection({
  children, fill, onToggle, open, sectionId, title, trailing,
}: PanelSectionProps) {
  const collapsible = Boolean(sectionId && onToggle);
  const expanded = !collapsible || open !== false;
  const head = (title || trailing) && (
    <>
      <span className="panel-section-title">{title}</span>
      {trailing}
      {collapsible && <span aria-hidden className="panel-section-mark">›</span>}
    </>
  );

  return (
    <section
      className="panel-section"
      data-collapsible={collapsible || undefined}
      data-fill={fill && expanded ? true : undefined}
      data-open={expanded || undefined}
    >
      {head && (collapsible ? (
        <button
          aria-expanded={expanded}
          className="panel-section-head"
          onClick={() => onToggle?.(sectionId as string)}
          type="button"
        >
          {head}
        </button>
      ) : <div className="panel-section-head">{head}</div>)}
      {expanded && <div className="panel-section-body">{children}</div>}
    </section>
  );
}

/** The scrolling stack of sections under a header. Exactly one per panel. */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="panel-body">{children}</div>;
}
