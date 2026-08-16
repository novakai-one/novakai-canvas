/** The original destinations + pinned objects layout, preserved as the default design. */
import './current-home.css';
import { field } from '../../../../object-graph/graph';
import { KIND_LABEL } from '../../../../object-graph/contract';
import { StateChip } from '../../../../components/ui/ui';
import type { HomeDesignProps } from '../../home-design';

/** Existing Home UI translated to the stable room design contract. */
export function CurrentHome({ data, commands }: HomeDesignProps) {
  return (
    <div className="home">
      <div className="home__sheet">
        <section>
          <h2 className="home__heading">Rooms</h2>
          <div className="home__destinations">
            {data.destinations.map((destination) => (
              <div
                className="destination"
                key={destination.key}
                data-attention={destination.needsAttention}
              >
                <span className="destination__rule" aria-hidden="true" />
                <div className="destination__text">
                  <span className="eyebrow">Room</span>
                  <span className="destination__title">{destination.label}</span>
                  <span className="destination__line">{destination.line}</span>
                </div>
                <div className="destination__foot">
                  <span className="destination__count">{destination.count}</span>
                  <button
                    type="button"
                    className="destination__enter"
                    onClick={() => commands.goToArea(destination.key)}
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
            {data.pins.map(({ pin, subject, canOpen }) => {
              const status = field(subject, 'status');
              return (
                <div
                  className="pin-card"
                  key={pin.id}
                  data-selected={data.selected?.id === subject.id}
                  data-attention={data.attentionSubjectId === subject.id}
                >
                  <button type="button" className="pin-card__body" onClick={() => commands.select(subject)}>
                    <span className="pin-card__head">
                      <span className="eyebrow">{KIND_LABEL[subject.kind]}</span>
                      {status && <StateChip state={status} />}
                    </span>
                    <span className="pin-card__title">{subject.title}</span>
                    <span className="pin-card__line">
                      {field(subject, 'notes') ||
                        field(subject, 'focus') ||
                        field(subject, 'description') ||
                        `${data.graph.related(subject.id).length} connected objects`}
                    </span>
                  </button>
                  {canOpen && (
                    <button
                      type="button"
                      className="pin-card__open"
                      onClick={() => commands.open(subject)}
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
