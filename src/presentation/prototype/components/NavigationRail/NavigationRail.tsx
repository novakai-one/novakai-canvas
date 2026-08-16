/**
 * The six product areas.
 *
 * The rail changes product area and preserves each area's own Room stack, so leaving
 * Missions mid-Stage and coming back puts you where you were. It never represents
 * Mission-internal hierarchy — that is the breadcrumb's job.
 */
import './navigation-rail.css';
import { AREAS, useStore, type AreaKey } from '../../app/store';

const ICON: Record<AreaKey, string> = {
  home: 'M3 9.2 10 3.5l7 5.7V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1Z',
  'command-center': 'M10 2.5 17.5 7v6L10 17.5 2.5 13V7Zm0 4.2L6.4 8.8v2.4L10 13.3l3.6-2.1V8.8Z',
  missions: 'M10 2.5A7.5 7.5 0 1 0 17.5 10M10 6.5A3.5 3.5 0 1 0 13.5 10M10 10l6-6',
  projects: 'M3 4.5h5.5v11H3Zm6.5 0H15v6.5H9.5Zm0 7.5H15v3.5H9.5Z',
  messages: 'M3 4.5h14v9H8l-4 3.5V13.5H3Z',
  'agent-roles': 'M10 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM4 17c0-3 2.7-5 6-5s6 2 6 5',
};

const STROKE_ICONS: ReadonlySet<AreaKey> = new Set(['missions', 'agent-roles']);

export function NavigationRail() {
  const { area, goToArea, railCollapsed, toggleRail, feed, elected, graph } = useStore();

  /** A count per area, so the rail says how much is waiting without a badge on every row. */
  const counts: Partial<Record<AreaKey, number>> = {
    'command-center': feed.length,
    messages: graph
      .byKind('notification')
      .filter(
        (n) => n.fields.status === 'unread' && (n.fields.subjectRef as { kind?: string })?.kind === 'thread',
      ).length,
  };

  /** Which area holds the one elected subject. Exactly one row may go gold. */
  const goldArea: AreaKey | null = elected ? 'command-center' : null;

  return (
    <nav className="navigation-rail" data-collapsed={railCollapsed} aria-label="Product areas">
      <div className="navigation-rail__top">
        <span className="navigation-rail__wordmark">{railCollapsed ? '>_' : '>_ novakai'}</span>
        <button
          type="button"
          className="navigation-rail__collapse"
          onClick={toggleRail}
          aria-label={railCollapsed ? 'Expand the rail' : 'Collapse the rail'}
          title={railCollapsed ? 'Expand the rail' : 'Collapse the rail'}
        >
          {railCollapsed ? '›' : '‹'}
        </button>
      </div>

      <ul className="navigation-rail__rows">
        {AREAS.map(({ key, label }) => (
          <li key={key}>
            <button
              type="button"
              className="navigation-rail__row"
              data-current={area === key}
              data-attention={goldArea === key}
              aria-current={area === key ? 'page' : undefined}
              title={label}
              onClick={() => goToArea(key)}
            >
              <svg className="navigation-rail__icon" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d={ICON[key]}
                  fill={STROKE_ICONS.has(key) ? 'none' : 'currentColor'}
                  stroke={STROKE_ICONS.has(key) ? 'currentColor' : 'none'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="navigation-rail__label">{label}</span>
              {counts[key] ? <span className="navigation-rail__count">{counts[key]}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="navigation-rail__footer">
        <span className="navigation-rail__person" title="Chris">
          CD
        </span>
        <span className="navigation-rail__label navigation-rail__person-name">Chris</span>
      </div>
    </nav>
  );
}
