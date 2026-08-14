/**
 * A Mission as the current Room, in either of its two projections.
 *
 * World and Document are the same objects with the same IDs, drawn two ways. Switching
 * between them changes presentation only — the Room, the breadcrumb and the selection
 * all survive the switch.
 */
import './mission-room.css';
import { useStore } from '../../app/store';
import { childStages, field, rootStages } from '../../object-graph/graph';
import type { ObjectRecord } from '../../object-graph/contract';
import { MissionWorld } from './MissionWorld';
import { StateChip } from '../../components/ui/ui';

/** One row of the reading projection. Selecting it drives the same inspector. */
function DocumentRow({
  record,
  depth,
  onSelect,
  selected,
}: {
  record: ObjectRecord;
  depth: number;
  onSelect: () => void;
  selected: boolean;
}) {
  const { enterRoom } = useStore();
  return (
    <div className="document-row" data-depth={depth} data-selected={selected}>
      <button type="button" className="document-row__body" onClick={onSelect}>
        <span className="document-row__rule" aria-hidden="true" />
        <span className="document-row__text">
          <span className="eyebrow">Stage</span>
          <span className="document-row__title">{record.title}</span>
          <span className="document-row__condition">{field(record, 'condition')}</span>
        </span>
        <StateChip state={field(record, 'status')} />
      </button>
      <button
        type="button"
        className="document-row__open"
        aria-label={`Open ${record.title}`}
        title="Enter this Stage"
        onClick={() => enterRoom({ kind: 'stage', subjectId: record.id })}
      >
        ↗
      </button>
    </div>
  );
}

function MissionDocument({ mission }: { mission: ObjectRecord }) {
  const { graph, select, selected } = useStore();

  const rows: { record: ObjectRecord; depth: number }[] = [];
  const walk = (stages: readonly ObjectRecord[], depth: number) => {
    for (const stage of stages) {
      rows.push({ record: stage, depth });
      walk(childStages(graph, stage.id), depth + 1);
    }
  };
  walk(rootStages(graph, mission.id), 0);

  const team = graph.relatedBy(mission.id, 'staffedBy').filter((r) => r.kind === 'team');
  const agents = graph.relatedBy(mission.id, 'staffedBy').filter((r) => r.kind === 'agent');
  const artifacts = graph.relatedBy(mission.id, 'produces');

  return (
    <div className="mission-document">
      <article className="mission-document__sheet">
        <p className="mission-document__outcome">{field(mission, 'notes')}</p>

        <h2 className="mission-document__heading">
          Work
          <span className="mission-document__count">{rows.length}</span>
        </h2>
        <div className="mission-document__rows">
          {rows.map(({ record, depth }) => (
            <DocumentRow
              key={record.id}
              record={record}
              depth={depth}
              selected={selected?.id === record.id}
              onSelect={() => select(record.id)}
            />
          ))}
        </div>

        {(team.length > 0 || agents.length > 0) && (
          <>
            <h2 className="mission-document__heading">
              Team
              <span className="mission-document__count">{team.length + agents.length}</span>
            </h2>
            <ul className="mission-document__list">
              {[...team, ...agents].map((record) => (
                <li key={record.id}>
                  <button type="button" className="mission-document__link" onClick={() => select(record.id)}>
                    <span className="eyebrow">{record.kind === 'team' ? 'Team' : 'Agent'}</span>
                    {record.title}
                  </button>
                  {record.kind === 'agent' && <StateChip state={field(record, 'status')} />}
                </li>
              ))}
            </ul>
          </>
        )}

        {artifacts.length > 0 && (
          <>
            <h2 className="mission-document__heading">
              Attached
              <span className="mission-document__count">{artifacts.length}</span>
            </h2>
            <ul className="mission-document__list">
              {artifacts.map((record) => (
                <li key={record.id}>
                  <button type="button" className="mission-document__link" onClick={() => select(record.id)}>
                    <span className="eyebrow">{record.kind === 'artifact' ? 'Artifact' : 'Evidence'}</span>
                    {record.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </div>
  );
}

export function MissionRoom({ missionId }: { missionId: string }) {
  const { graph, projection } = useStore();
  const mission = graph.get(missionId);
  if (!mission) return null;
  return projection === 'world' ? (
    <MissionWorld subject={mission} />
  ) : (
    <MissionDocument mission={mission} />
  );
}
