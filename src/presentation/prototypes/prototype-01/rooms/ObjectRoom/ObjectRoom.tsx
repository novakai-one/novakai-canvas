/**
 * Two smaller Rooms that share one reading layout: a Project and an Agent.
 *
 * Both answer the same shape of question — what does this object own, and what is it
 * connected to — so they share a surface rather than each growing their own.
 */
import './object-room.css';
import { useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import { KIND_LABEL, type ObjectRecord } from '../../object-graph/contract';
import { EmptyState, StateChip } from '../../components/ui/ui';
import { roomFor } from '../../room-navigation/room-for';

function Row({ record }: { record: ObjectRecord }) {
  const { select, selected, enterRoom, elected } = useStore();
  const room = roomFor(record);
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
      data-selected={selected?.id === record.id}
      data-attention={elected?.subject.id === record.id}
    >
      <button type="button" className="object-room__row-body" onClick={() => select(record.id)}>
        <span className="object-room__row-text">
          <span className="eyebrow">{KIND_LABEL[record.kind]}</span>
          <span className="object-room__row-title">{record.title}</span>
          {line && <span className="object-room__row-line">{line}</span>}
        </span>
        {status && <StateChip state={status} />}
      </button>
      {room && (
        <button
          type="button"
          className="object-room__row-open"
          title={`Open ${KIND_LABEL[record.kind]}`}
          aria-label={`Open ${record.title}`}
          onClick={() => enterRoom(room)}
        >
          ↗
        </button>
      )}
    </div>
  );
}

function Section({ label, records }: { label: string; records: readonly ObjectRecord[] }) {
  if (records.length === 0) return null;
  return (
    <section>
      <h2 className="object-room__heading">
        {label}
        <span className="object-room__count">{records.length}</span>
      </h2>
      <div className="object-room__rows">
        {records.map((record) => (
          <Row key={record.id} record={record} />
        ))}
      </div>
    </section>
  );
}

export function ProjectRoom({ projectId }: { projectId: string }) {
  const { graph } = useStore();
  const project = graph.get(projectId);
  if (!project) return null;
  const missions = graph.relatedOfKind(project.id, 'contains', 'mission');

  return (
    <div className="object-room">
      <article className="object-room__sheet">
        <p className="object-room__lead">{field(project, 'focus')}</p>
        <p className="object-room__path">{field(project, 'path')}</p>
        {missions.length === 0 ? (
          <EmptyState>No missions are attached to this project yet.</EmptyState>
        ) : (
          <Section label="Missions in this project" records={missions} />
        )}
      </article>
    </div>
  );
}

export function AgentRoom({ agentId }: { agentId: string }) {
  const { graph } = useStore();
  const agent = graph.get(agentId);
  if (!agent) return null;

  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  const role = seat ? graph.relatedBy(seat.id, 'requests')[0] : undefined;
  const runs = graph.relatedOfKind(agent.id, 'contains', 'agentRun');
  const work = graph.relatedBy(agent.id, 'assigned');
  const threads = graph.relatedBy(agent.id, 'discussedIn');
  const missions = graph.relatedBy(agent.id, 'belongsTo').filter((r) => r.kind === 'mission');

  return (
    <div className="object-room">
      <article className="object-room__sheet">
        <div className="object-room__identity">
          <div>
            <span className="eyebrow">Provider</span>
            <p>{field(agent, 'provider')}</p>
          </div>
          <div>
            <span className="eyebrow">Presence</span>
            <p>
              <StateChip state={field(agent, 'status')} />
            </p>
          </div>
          <div>
            <span className="eyebrow">Session</span>
            <p className="object-room__mono">{field(agent, 'sessionId') || 'none'}</p>
          </div>
          <div>
            <span className="eyebrow">Role in seat</span>
            <p>{role?.title ?? 'Unseated'}</p>
          </div>
        </div>

        <Section label="Mission" records={missions} />
        <Section label="Assigned work" records={work} />
        <Section label="Runs" records={runs} />
        <Section label="Conversations" records={threads} />
      </article>
    </div>
  );
}
