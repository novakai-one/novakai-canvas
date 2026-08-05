import type { ReactNode } from 'react';

/**
 * A titled group inside a panel body.
 *
 * Sections are the only way content enters a panel, so every panel body is a stack of the same
 * block at the same rhythm regardless of what is selected.
 */
export function PanelSection({
  children, fill, title, trailing,
}: {
  title?: string;
  trailing?: ReactNode;
  /** Takes the leftover height of the body — for the one section that is a list. */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="panel-section" data-fill={fill || undefined}>
      {(title || trailing) && (
        <div className="panel-section-head">
          <span className="panel-section-title">{title}</span>
          {trailing}
        </div>
      )}
      <div className="panel-section-body">{children}</div>
    </section>
  );
}

/** The scrolling stack of sections under a header. Exactly one per panel. */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="panel-body">{children}</div>;
}
