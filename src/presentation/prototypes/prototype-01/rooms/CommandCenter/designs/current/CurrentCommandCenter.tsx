/**
 * What is waiting on you, and what you can do about it without leaving.
 *
 * Two kinds of control sit on every row and they are deliberately different shapes: the
 * inline actions change fixture state in place, and the arrow opens the related object's
 * Room. Selecting a row opens its inspector and moves nothing.
 */
import '../../command-center.css';
import { makeRecord, sessionId } from '../../../../app/store';
import { REASON_GROUPS, REASON_LABEL, type AttentionItem } from '../../../../attention/feed';
import { field } from '../../../../object-graph/graph';
import { KIND_LABEL } from '../../../../object-graph/contract';
import { ActionButton, EmptyState } from '../../../../components/ui/ui';
import type {
  CommandCenterDesignCommands,
  CommandCenterDesignData,
  CommandCenterDesignProps,
} from '../../command-center-design';

/** A new agent to take over a seat whose occupant stopped. */
const REPLACEMENTS = ['Rune', 'Vell', 'Orin', 'Perrin'];

function AttentionRow({
  item,
  elected,
  data,
  commands,
}: {
  item: AttentionItem;
  elected: boolean;
  data: CommandCenterDesignData;
  commands: CommandCenterDesignCommands;
}) {
  const { selected, graph } = data;
  const { select, patch, addRecord } = commands;
  const openTarget = graph.get(item.openId);
  const canOpen = openTarget ? commands.canOpen(openTarget) : false;

  /** Every action here edits state in place. None of them changes the Room. */
  const act = (kind: string) => {
    const subject = item.subject;
    switch (item.reason) {
      case 'decision':
        select(subject.id);
        return;
      case 'blocked':
        patch(subject.id, { status: 'todo', blockedReason: '' });
        return;
      case 'agent-failed': {
        if (kind === 'stop') {
          patch(subject.id, { status: 'retired' });
          return;
        }
        const name = REPLACEMENTS[Math.floor(Math.random() * REPLACEMENTS.length)];
        const id = sessionId('agent', name);
        addRecord(
          makeRecord(id, 'agent', name, {
            status: 'live',
            provider: 'anthropic',
            sessionId: `sess_${name.toLowerCase()}_new`,
            updated: new Date().toISOString(),
          }),
        );
        patch(subject.id, { status: 'retired' });
        const seat = graph.relatedBy(subject.id, 'occupies')[0];
        if (seat) patch(seat.id, { agentId: id });
        return;
      }
      case 'seat-vacant': {
        const name = REPLACEMENTS[Math.floor(Math.random() * REPLACEMENTS.length)];
        const id = sessionId('agent', name);
        addRecord(
          makeRecord(id, 'agent', name, {
            status: 'live',
            provider: 'anthropic',
            sessionId: `sess_${name.toLowerCase()}_new`,
            updated: new Date().toISOString(),
          }),
        );
        patch(subject.id, { agentId: id });
        return;
      }
      case 'issue':
        patch(subject.id, { status: 'resolved' });
        return;
      case 'message-waiting':
        patch(subject.id, { status: 'read' });
        return;
      default:
        patch(subject.id, { attentionState: 'settled' });
    }
  };

  return (
    <div
      className="attention-row"
      data-elected={elected}
      data-selected={selected?.id === item.subject.id}
      data-reason={item.reason}
    >
      <button type="button" className="attention-row__body" onClick={() => select(item.subject.id)}>
        <span className="attention-row__mark" aria-hidden="true" />
        <span className="attention-row__text">
          <span className="attention-row__subject">{item.label}</span>
          <span className="attention-row__detail">{item.detail}</span>
        </span>
        <span className="attention-row__since">{item.since}</span>
      </button>
      <div className="attention-row__actions">
        {item.actions.map((action) => (
          <ActionButton key={action.label} variant="ghost" onClick={() => act(action.kind)}>
            {action.label}
          </ActionButton>
        ))}
        {canOpen && openTarget && (
          <button
            type="button"
            className="attention-row__open"
            title={`Open ${KIND_LABEL[openTarget.kind]} — ${openTarget.title}`}
            aria-label={`Open ${openTarget.title}`}
            onClick={() => commands.open(openTarget)}
          >
            ↗
          </button>
        )}
      </div>
    </div>
  );
}

export function CurrentCommandCenter({ data, commands }: CommandCenterDesignProps) {
  const { feed, elected, graph } = data;

  const live = graph.byKind('agent').filter((a) => field(a, 'status') === 'live').length;
  const runs = graph.byKind('agentRun').filter((r) => field(r, 'status') === 'running').length;

  return (
    <div className="command-center">
      <div className="command-center__sheet">
        <div className="command-center__ledger">
          <span>
            <strong>{feed.length}</strong> waiting
          </span>
          <span>
            <strong>{live}</strong> agents live
          </span>
          <span>
            <strong>{runs}</strong> runs in flight
          </span>
        </div>

        {feed.length === 0 && (
          <EmptyState>
            Nothing is waiting on you. Start a mission or open a conversation when you want to
            change that.
          </EmptyState>
        )}

        {REASON_GROUPS.map((reason) => {
          const items = feed.filter((item) => item.reason === reason);
          if (items.length === 0) return null;
          return (
            <section className="command-center__group" key={reason}>
              <h2 className="command-center__group-label">
                {REASON_LABEL[reason]}
                <span className="command-center__group-count">{items.length}</span>
              </h2>
              <div className="command-center__rows">
                {items.map((item) => (
                  <AttentionRow
                    key={item.id}
                    item={item}
                    elected={elected?.id === item.id}
                    data={data}
                    commands={commands}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
