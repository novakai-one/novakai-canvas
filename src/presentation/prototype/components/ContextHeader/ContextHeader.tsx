/**
 * Compact Room context: ancestors navigate, the current subject inspects, and
 * projection changes only how Mission and Stage Rooms are drawn.
 */
import './context-header.css';
import { AREAS, useStore, type Room } from '../../app/store';
import { KIND_LABEL } from '../../object-graph/contract';

export function ContextHeader() {
  const { stack, room, graph, goBack, goToDepth, projection, setProjection, select } = useStore();

  const label = (entry: Room): string => {
    if (entry.kind === 'area') return AREAS.find((area) => area.key === entry.area)?.label ?? entry.area;
    return graph.get(entry.subjectId)?.title ?? entry.subjectId;
  };

  if (room.kind === 'area') {
    return (
      <header className="context-header context-header--root">
        <h1 className="context-header__page-title">{label(room)}</h1>
      </header>
    );
  }

  const subject = graph.get(room.subjectId);
  const showsProjection = room.kind === 'mission' || room.kind === 'stage';
  const ancestors = stack.slice(0, -1);

  return (
    <header className="context-header context-header--nested" aria-label="Room context">
      <button
        type="button"
        className="context-header__back"
        onClick={goBack}
        aria-label="Back one level"
        title="Back one level"
      >
        ←
      </button>

      <div className="context-header__path">
        <nav className="context-header__crumbs" aria-label="Room ancestry">
          {ancestors.map((entry, index) => {
            const entryLabel = label(entry);
            return (
              <span className="context-header__crumb" key={`${index}-${entryLabel}`}>
                <button
                  type="button"
                  className="context-header__crumb-button"
                  onClick={() => goToDepth(index)}
                  title={`Go to ${entryLabel}`}
                >
                  {entryLabel}
                </button>
                <span className="context-header__sep" aria-hidden="true">
                  ›
                </span>
              </span>
            );
          })}
        </nav>

        {subject ? (
          <button
            type="button"
            className="context-header__current"
            onClick={() => select(subject.id)}
            aria-label={`Inspect ${subject.title}`}
            title={`Inspect this ${KIND_LABEL[subject.kind].toLowerCase()}`}
          >
            {subject.title}
          </button>
        ) : (
          <span className="context-header__current" title={label(room)}>
            {label(room)}
          </span>
        )}
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
    </header>
  );
}
