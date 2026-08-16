/**
 * One role blueprint card, with the chain a seat makes real — Role requested by a
 * Seat, occupied by an Agent, working as an AgentRun — drawn as one line of typed hops.
 */
import { field } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { ActionButton, StateChip } from '../../../../components/ui/ui';
import type { AgentRolesDesignCommands, AgentRolesDesignData } from '../../agent-roles-design';
import { RoleEditor } from './RoleEditor';

function OccupancyStrip({ role, data, commands }: {
  role: ObjectRecord;
  data: AgentRolesDesignData;
  commands: AgentRolesDesignCommands;
}) {
  const { graph } = data;
  const seats = graph.relatedBy(role.id, 'requestedBy');

  if (seats.length === 0) {
    return <p className="role-card__occupancy role-card__occupancy--empty">No seat requests this role yet.</p>;
  }

  return (
    <div className="role-card__occupancy">
      {seats.map((seat) => {
        const agent = graph.relatedBy(seat.id, 'occupiedBy')[0];
        const run = agent
          ? graph.relatedOfKind(agent.id, 'contains', 'agentRun').find((r) => field(r, 'status') === 'running')
          : undefined;
        const team = graph.relatedBy(seat.id, 'belongsTo').find((r) => r.kind === 'team');
        return (
          <div className="occupancy" key={seat.id}>
            <button type="button" className="occupancy__hop" onClick={() => commands.select(seat)}>
              <span className="eyebrow">Seat</span>
              <span className="occupancy__name">{team?.title ?? 'Seat'}</span>
            </button>
            <span className="occupancy__arrow" aria-hidden="true">
              →
            </span>
            {agent ? (
              <button
                type="button"
                className="occupancy__hop"
                data-live={field(agent, 'status') === 'live'}
                onClick={() => commands.openAgent(agent)}
              >
                <span className="eyebrow">Agent</span>
                <span className="occupancy__name">{agent.title}</span>
              </button>
            ) : (
              <span className="occupancy__hop occupancy__hop--vacant">
                <span className="eyebrow">Agent</span>
                <span className="occupancy__name">Vacant</span>
              </span>
            )}
            <span className="occupancy__arrow" aria-hidden="true">
              →
            </span>
            {run ? (
              <button type="button" className="occupancy__hop" onClick={() => commands.select(run)}>
                <span className="eyebrow">Run</span>
                <span className="occupancy__name">
                  {graph.relatedBy(run.id, 'attempts')[0]?.title ?? 'Working'}
                </span>
              </button>
            ) : (
              <span className="occupancy__hop occupancy__hop--vacant">
                <span className="eyebrow">Run</span>
                <span className="occupancy__name">Idle</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RoleCard({ role, data, commands, editing, onEdit, onDoneEditing }: {
  role: ObjectRecord;
  data: AgentRolesDesignData;
  commands: AgentRolesDesignCommands;
  editing: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
}) {
  const effort = (role.fields.effortPolicy as { defaultEffort?: string })?.defaultEffort;
  const model = (role.fields.modelPolicy as { defaultModelId?: string })?.defaultModelId;
  const permission = (role.fields.__envelope as { permissionLevel?: string })?.permissionLevel;

  return (
    <article
      className="role-card"
      data-selected={data.selected?.id === role.id}
      data-attention={data.attentionSubjectId === role.id}
    >
      <button type="button" className="role-card__body" onClick={() => commands.select(role)}>
        <span className="role-card__head">
          <span className="eyebrow">Role blueprint</span>
          <StateChip state={field(role, 'status')} />
        </span>
        <span className="role-card__title">{role.title}</span>
        <span className="role-card__description">{field(role, 'description')}</span>
      </button>

      <dl className="role-card__policy">
        <div>
          <dt>Permission</dt>
          <dd>{permission ?? '—'}</dd>
        </div>
        <div>
          <dt>Effort</dt>
          <dd>{effort ?? '—'}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{model ?? '—'}</dd>
        </div>
      </dl>

      <OccupancyStrip role={role} data={data} commands={commands} />

      {editing ? (
        <RoleEditor role={role} commands={commands} onDone={onDoneEditing} />
      ) : (
        <div className="role-card__actions">
          <ActionButton variant="ghost" onClick={onEdit}>
            Edit blueprint
          </ActionButton>
        </div>
      )}
    </article>
  );
}
