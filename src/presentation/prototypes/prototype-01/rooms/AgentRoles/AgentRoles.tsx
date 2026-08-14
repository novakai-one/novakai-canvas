/**
 * The role blueprint library.
 *
 * A Role is a class, not an instance. The chain a seat makes real — Role requested by a
 * Seat, occupied by an Agent, working as an AgentRun — is drawn on every card, because
 * that chain is the thing people get wrong when they conflate an agent with its role.
 */
import { useState } from 'react';
import './agent-roles.css';
import { makeRecord, sessionId, useStore } from '../../app/store';
import { field } from '../../object-graph/graph';
import type { ObjectRecord } from '../../object-graph/contract';
import { ActionButton, SearchField, StateChip } from '../../components/ui/ui';

const EFFORTS = ['low', 'medium', 'high'];
const PERMISSIONS = ['read-only', 'restricted', 'workspace-write', 'orchestrate', 'vault'];

/** Role → Seat → Agent → AgentRun, drawn as one line of typed hops. */
function OccupancyStrip({ role }: { role: ObjectRecord }) {
  const { graph, select, enterRoom } = useStore();
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
            <button type="button" className="occupancy__hop" onClick={() => select(seat.id)}>
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
                onClick={() => enterRoom({ kind: 'agent', subjectId: agent.id })}
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
              <button type="button" className="occupancy__hop" onClick={() => select(run.id)}>
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

function RoleEditor({ role, onDone }: { role: ObjectRecord; onDone: () => void }) {
  const { patch } = useStore();
  const [name, setName] = useState(role.title);
  const [description, setDescription] = useState(field(role, 'description'));
  const [permission, setPermission] = useState(
    String((role.fields.__envelope as { permissionLevel?: string })?.permissionLevel ?? 'workspace-write'),
  );
  const [effort, setEffort] = useState(
    String((role.fields.effortPolicy as { defaultEffort?: string })?.defaultEffort ?? 'medium'),
  );

  return (
    <form
      className="role-editor"
      onSubmit={(event) => {
        event.preventDefault();
        patch(role.id, {
          title: name,
          name,
          description,
          permissionLevel: permission,
          effortPolicy: { ...(role.fields.effortPolicy as object), defaultEffort: effort },
          __envelope: { ...(role.fields.__envelope as object), permissionLevel: permission },
        });
        onDone();
      }}
    >
      <label className="role-editor__label">
        Name
        <input className="role-editor__input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="role-editor__label">
        What this role is responsible for
        <textarea
          className="role-editor__input role-editor__input--area"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="role-editor__row">
        <label className="role-editor__label">
          Permission
          <select
            className="role-editor__input"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            {PERMISSIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="role-editor__label">
          Default effort
          <select className="role-editor__input" value={effort} onChange={(e) => setEffort(e.target.value)}>
            {EFFORTS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="role-editor__actions">
        <ActionButton variant="ghost" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={() => {
            patch(role.id, {
              title: name,
              name,
              description,
              permissionLevel: permission,
              effortPolicy: { ...(role.fields.effortPolicy as object), defaultEffort: effort },
              __envelope: { ...(role.fields.__envelope as object), permissionLevel: permission },
            });
            onDone();
          }}
        >
          Save role
        </ActionButton>
      </div>
    </form>
  );
}

export function AgentRoles() {
  const { graph, select, selected, addRecord, elected } = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const roles = graph
    .byKind('agentRoleProfile')
    .filter((role) => role.title.toLowerCase().includes(query.toLowerCase()));

  const createRole = () => {
    const id = sessionId('role', 'new role');
    addRecord(
      makeRecord(id, 'agentRoleProfile', 'New role', {
        name: 'New role',
        description: 'Say what this role owns, and where its authority stops.',
        status: 'draft',
        permissionLevel: 'read-only',
        effortPolicy: { allowed: EFFORTS, defaultEffort: 'medium' },
        modelPolicy: { defaultModelId: 'claude-sonnet-5' },
        providerPolicy: { defaultProvider: 'anthropic' },
        __envelope: { id, kind: 'agentRoleProfile', schemaVersion: 2, permissionLevel: 'read-only' },
      }),
    );
    select(id);
    setEditing(id);
  };

  return (
    <div className="agent-roles">
      <div className="agent-roles__sheet">
        <div className="agent-roles__toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search roles" />
          <ActionButton onClick={createRole}>New role</ActionButton>
        </div>

        <div className="agent-roles__grid">
          {roles.map((role) => {
            const effort = (role.fields.effortPolicy as { defaultEffort?: string })?.defaultEffort;
            const model = (role.fields.modelPolicy as { defaultModelId?: string })?.defaultModelId;
            const permission = (role.fields.__envelope as { permissionLevel?: string })?.permissionLevel;
            return (
              <article
                className="role-card"
                key={role.id}
                data-selected={selected?.id === role.id}
                data-attention={elected?.subject.id === role.id}
              >
                <button type="button" className="role-card__body" onClick={() => select(role.id)}>
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

                <OccupancyStrip role={role} />

                {editing === role.id ? (
                  <RoleEditor role={role} onDone={() => setEditing(null)} />
                ) : (
                  <div className="role-card__actions">
                    <ActionButton variant="ghost" onClick={() => setEditing(role.id)}>
                      Edit blueprint
                    </ActionButton>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
