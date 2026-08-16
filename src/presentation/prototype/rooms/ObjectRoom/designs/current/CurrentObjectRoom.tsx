/** The original Project/Agent reading layout, preserved as the default registered design. */
import './current-object-room.css';
import { KIND_LABEL, type ObjectRecord } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import { EmptyState, StateChip } from '../../../../components/ui/ui';
import type { ObjectRoomDesignData, ObjectRoomDesignCommands, ObjectRoomDesignProps, IdentityFact, ObjectRoomSection } from '../../object-room-design';

function Row({ record, data, commands }: {
  record: ObjectRecord;
  data: ObjectRoomDesignData;
  commands: ObjectRoomDesignCommands;
}) {
  const status = field(record, 'status');
  const line =
    field(record, 'notes') ||
    field(record, 'condition') ||
    field(record, 'goal') ||
    field(record, 'description') ||
    field(record, 'blockedReason');

  return (
    <div
      className="object-room__row"
      data-selected={data.selected?.id === record.id}
      data-attention={data.attentionSubjectId === record.id}
    >
      <button type="button" className="object-room__row-body" onClick={() => commands.select(record)}>
        <span className="object-room__row-text">
          <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
          <span className="object-room__row-title">{record.title}</span>
          {line && <span className="object-room__row-line">{line}</span>}
        </span>
        {status && <StateChip state={status} />}
      </button>
      {data.openableIds.has(record.id) && (
        <button
          type="button"
          className="object-room__row-open"
          title={`Open ${KIND_LABEL[record.kind]}`}
          aria-label={`Open ${record.title}`}
          onClick={() => commands.open(record)}
        >
          ↗
        </button>
      )}
    </div>
  );
}

function Section({ section, data, commands }: {
  section: ObjectRoomSection;
  data: ObjectRoomDesignData;
  commands: ObjectRoomDesignCommands;
}) {
  if (section.records.length === 0) {
    return section.emptyMessage ? <EmptyState>{section.emptyMessage}</EmptyState> : null;
  }
  return (
    <section>
      <h2 className="object-room__heading">
        {section.label}
        <span className="object-room__count">{section.records.length}</span>
      </h2>
      <div className="object-room__rows">
        {section.records.map((record) => (
          <Row key={record.id} record={record} data={data} commands={commands} />
        ))}
      </div>
    </section>
  );
}

function IdentityGrid({ facts }: { facts: readonly IdentityFact[] }) {
  return (
    <div className="object-room__identity">
      {facts.map((fact) => (
        <div key={fact.label}>
          <span className="eyebrow">{fact.label}</span>
          {fact.renderAs === 'status' ? (
            <p><StateChip state={fact.value} /></p>
          ) : (
            <p className={fact.renderAs === 'mono' ? 'object-room__mono' : undefined}>{fact.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** A Project reads as focus + path lines; an Agent reads as an identity grid. */
function Identity({ subject, facts }: { subject: ObjectRecord; facts: readonly IdentityFact[] }) {
  if (subject.kind === 'project') {
    const [focus, path] = facts;
    return (
      <>
        {focus && <p className="object-room__lead">{focus.value}</p>}
        {path && <p className="object-room__path">{path.value}</p>}
      </>
    );
  }
  return <IdentityGrid facts={facts} />;
}

/** Existing Object Room sheet translated to the stable room design contract. */
export function CurrentObjectRoom({ data, commands }: ObjectRoomDesignProps) {
  return (
    <div className="object-room">
      <article className="object-room__sheet">
        <Identity subject={data.subject} facts={data.identity} />
        {data.sections.map((section) => (
          <Section key={section.label} section={section} data={data} commands={commands} />
        ))}
      </article>
    </div>
  );
}
