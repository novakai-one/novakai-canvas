/**
 * Personal orientation, and the way into everything else.
 *
 * Home duplicates the rail's job so a collapsed rail costs nothing, and it holds the
 * objects you pinned. A destination and a pin behave the same way as everything else:
 * selecting shows you what it is, and a separate control takes you there.
 */
import './home.css';
import { AREAS, useStore, type AreaKey } from '../../app/store';
import { field } from '../../object-graph/graph';
import { KIND_LABEL } from '../../object-graph/contract';
import { StateChip } from '../../components/ui/ui';
import { roomFor } from '../../room-navigation/room-for';

const DESTINATION_LINE: Record<AreaKey, string> = {
  home: 'Where you are.',
  'command-center': 'Decisions, blocked work and agents that stopped.',
  missions: 'Every mission, planned through completed.',
  projects: 'The containers missions belong to.',
  messages: 'Conversations attached to their work.',
  'agent-roles': 'Blueprints a seat can request.',
};

export function Home() {
  const { graph, goToArea, feed, select, selected, enterRoom, elected } = useStore();

  const counts: Partial<Record<AreaKey, string>> = {
    'command-center': `${feed.length} waiting`,
    missions: `${graph.byKind('mission').length} missions`,
    projects: `${graph.byKind('project').length} projects`,
    messages: `${graph.byKind('thread').length} conversations`,
    'agent-roles': `${graph.byKind('agentRoleProfile').length} blueprints`,
  };

  const pins = graph
    .byKind('pin')
    .slice()
    .sort((a, b) => Number(a.fields.order ?? 0) - Number(b.fields.order ?? 0));

  return (
    <div className="home">
      <div className="home__sheet">
        <section>
          <h2 className="home__heading">Rooms</h2>
          <div className="home__destinations">
            {AREAS.filter((area) => area.key !== 'home').map((area) => (
              <div
                className="destination"
                key={area.key}
                data-attention={area.key === 'command-center' && Boolean(elected)}
              >
                <span className="destination__rule" aria-hidden="true" />
                <div className="destination__text">
                  <span className="eyebrow">Room</span>
                  <span className="destination__title">{area.label}</span>
                  <span className="destination__line">{DESTINATION_LINE[area.key]}</span>
                </div>
                <div className="destination__foot">
                  <span className="destination__count">{counts[area.key]}</span>
                  <button
                    type="button"
                    className="destination__enter"
                    onClick={() => goToArea(area.key)}
                  >
                    Enter Room
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="home__heading">Pinned</h2>
          <div className="home__pins">
            {pins.map((pin) => {
              const subject = graph.relatedBy(pin.id, 'pins')[0];
              if (!subject) return null;
              const room = roomFor(subject);
              const status = field(subject, 'status');
              return (
                <div
                  className="pin-card"
                  key={pin.id}
                  data-selected={selected?.id === subject.id}
                  data-attention={elected?.subject.id === subject.id}
                >
                  <button type="button" className="pin-card__body" onClick={() => select(subject.id)}>
                    <span className="pin-card__head">
                      <span className="eyebrow">{KIND_LABEL[subject.kind]}</span>
                      {status && <StateChip state={status} />}
                    </span>
                    <span className="pin-card__title">{subject.title}</span>
                    <span className="pin-card__line">
                      {field(subject, 'notes') ||
                        field(subject, 'focus') ||
                        field(subject, 'description') ||
                        `${graph.related(subject.id).length} connected objects`}
                    </span>
                  </button>
                  {room && (
                    <button
                      type="button"
                      className="pin-card__open"
                      onClick={() => enterRoom(room)}
                      title={`Open ${KIND_LABEL[subject.kind]}`}
                    >
                      Open {KIND_LABEL[subject.kind]}
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
