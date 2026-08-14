/**
 * Back, the complete visited path, the Room's identity, and the projection switch.
 *
 * Breadcrumbs live here and nowhere else. Switching World/Document changes how the
 * current Room is drawn; it never changes which Room you are in.
 */
import './context-header.css';
import { AREAS, useStore, type Room } from '../../app/store';
import { KIND_LABEL } from '../../object-graph/contract';

const AREA_TAGLINE: Record<string, string> = {
  home: 'Everything you pinned, and the way into everything else.',
  'command-center': 'What is waiting on you, and what you can do about it here.',
  missions: 'Every mission, planned through completed.',
  projects: 'Projects hold the missions that serve them.',
  messages: 'Conversations stay attached to the work they belong to.',
  'agent-roles': 'Reusable blueprints a seat can request and an agent can adopt.',
};

export function ContextHeader() {
  const { stack, room, graph, goBack, goToDepth, projection, setProjection, elected, goToArea, select } =
    useStore();

  const label = (entry: Room): string => {
    if (entry.kind === 'area') return AREAS.find((a) => a.key === entry.area)?.label ?? entry.area;
    return graph.get(entry.subjectId)?.title ?? entry.subjectId;
  };

  const subject = room.kind === 'area' ? null : graph.get(room.subjectId);
  const showsProjection = room.kind === 'mission' || room.kind === 'stage';
  const areaKey = stack[0].kind === 'area' ? stack[0].area : 'home';
  const atArea = room.kind === 'area';

  return (
    <header className="context-header">
      <div className="context-header__line">
        <button
          type="button"
          className="context-header__back"
          onClick={goBack}
          disabled={stack.length < 2}
          aria-label="Back one level"
          title="Back one level"
        >
          ←
        </button>
        <nav className="context-header__crumbs" aria-label="Path">
          {stack.map((entry, index) => (
            <span className="context-header__crumb" key={`${index}-${label(entry)}`}>
              {index > 0 && (
                <span className="context-header__sep" aria-hidden="true">
                  ›
                </span>
              )}
              <button
                type="button"
                className="context-header__crumb-button"
                data-current={index === stack.length - 1}
                onClick={() => goToDepth(index)}
              >
                {label(entry)}
              </button>
            </span>
          ))}
        </nav>

        {/* The one gold signal. It hides in the Command Center, where the elected row
            carries the accent instead — two golds would be one too many. */}
        {elected && areaKey !== 'command-center' && (
          <button
            type="button"
            className="context-header__beacon"
            onClick={() => {
              goToArea('command-center');
              select(elected.subject.id);
            }}
            title={`${elected.label} — go to it`}
          >
            <span className="context-header__beacon-mark" aria-hidden="true" />
            <span className="context-header__beacon-text">{elected.label}</span>
          </button>
        )}
      </div>

      <div className="context-header__line context-header__line--subject">
        <div className="context-header__identity">
          <span className="eyebrow">{subject ? KIND_LABEL[subject.kind] : 'Room'}</span>
          {/* The Room's own object is selectable from its title. Without this, a Room is
              the one thing on screen you cannot inspect — and its parent (a Mission's
              Project, say) becomes unreachable from inside it. */}
          {subject ? (
            <button
              type="button"
              className="context-header__title context-header__title--selectable"
              onClick={() => select(subject.id)}
              title={`Inspect this ${KIND_LABEL[subject.kind].toLowerCase()}`}
            >
              {subject.title}
            </button>
          ) : (
            <h1 className="context-header__title">{label(room)}</h1>
          )}
          {atArea && <p className="context-header__tagline">{AREA_TAGLINE[areaKey]}</p>}
        </div>

        {showsProjection && (
          <div className="context-header__projection" role="group" aria-label="Projection">
            {(['world', 'document'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className="context-header__projection-option"
                data-current={projection === mode}
                aria-pressed={projection === mode}
                onClick={() => setProjection(mode)}
              >
                {mode === 'world' ? 'World' : 'Document'}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
