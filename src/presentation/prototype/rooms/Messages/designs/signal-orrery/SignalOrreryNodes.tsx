import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_LABEL } from '../../../../object-graph/contract';
import { field } from '../../../../object-graph/graph';
import type { OrreryNode, OrreryNodeData } from './signal-orrery-geometry';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function ConversationNode({ data }: { data: OrreryNodeData }) {
  const { conversation } = data;
  const name = conversation.agent?.title ?? conversation.record.title;
  const lastMessage = conversation.messages.at(-1);

  return (
    <div className="signal-node__conversation-core">
      {data.focused && (
        <>
          <span className="signal-node__orbit signal-node__orbit--outer" aria-hidden="true" />
          <span className="signal-node__orbit signal-node__orbit--inner" aria-hidden="true" />
          <span className="signal-node__now-meridian" aria-hidden="true"><i />Now</span>
        </>
      )}
      <span className="signal-node__initials">{initials(name)}</span>
      <span className="signal-node__kind">{data.focused ? 'Agent link' : 'Conversation'}</span>
      <strong>{name}</strong>
      <small>{conversation.agentRole}</small>
      {!data.focused && lastMessage && <p>{lastMessage.body}</p>}
      <span className="signal-node__activity">
        {conversation.unread ? 'Unread' : data.current ? 'In focus' : lastMessage?.timeLabel || 'Ready'}
      </span>
    </div>
  );
}

function MessageNode({ data }: { data: OrreryNodeData }) {
  const message = data.message;
  if (!message) return null;

  return (
    <div className="signal-node__message-body">
      <span className="signal-node__sequence">{String(data.sequence).padStart(2, '0')}</span>
      <span className="signal-node__message-meta">
        {message.sentByPrincipal ? 'You' : data.conversation.agent?.title ?? 'Agent'} · {message.timeLabel}
      </span>
      <p>{message.body}</p>
      {message.references.length > 0 && (
        <span className="signal-node__reference-count">{message.references.length} linked</span>
      )}
    </div>
  );
}

function SatelliteNode({ data }: { data: OrreryNodeData }) {
  const context = data.variant === 'mission' ? 'Mission context' : KIND_LABEL[data.record.kind];
  const status = field(data.record, 'status');

  return (
    <div className="signal-node__satellite-body">
      <span>{context}</span>
      <strong>{data.record.title}</strong>
      {status && <small>{status}</small>}
    </div>
  );
}

/** Renders the conversation, message and relationship objects in the orbital scene. */
export function SignalOrreryNode({ data, selected }: NodeProps<OrreryNode>) {
  return (
    <div
      className="signal-orrery-node"
      data-variant={data.variant}
      data-focused={data.focused}
      data-current={data.current}
      data-dimmed={data.dimmed}
      data-attention={data.attention}
      data-depth={data.depth}
      data-tier={data.tier}
      data-selected={selected}
      data-mine={data.message?.sentByPrincipal ?? false}
    >
      <Handle className="signal-orrery-node__handle" type="target" position={Position.Top} />
      {data.variant === 'conversation' && <ConversationNode data={data} />}
      {data.variant === 'message' && <MessageNode data={data} />}
      {(data.variant === 'mission' || data.variant === 'reference') && <SatelliteNode data={data} />}
      <Handle className="signal-orrery-node__handle" type="source" position={Position.Bottom} />
    </div>
  );
}
