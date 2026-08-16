/**
 * One object standing on the field.
 *
 * Urgency is height and light, never a badge: the monolith is a different order of
 * object from an ordinary chip, and everything a chip states it states with scale,
 * opacity and the single amber — no borders, no dots, no pills at rest.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_LABEL } from '../../../../object-graph/contract';
import type { ChainChipNode } from './field-to-flow';

export function ChainNode({ data, selected }: NodeProps<ChainChipNode>) {
  const { record, variant, depth, tier, dimmed, lit, settling, item, onAct } = data;
  const showActions = tier === 'near' && item && onAct && !settling && variant !== 'sediment';

  return (
    <div
      className="chain-chip"
      data-variant={variant}
      data-depth={Math.min(depth, 3)}
      data-tier={tier}
      data-selected={selected}
      data-dimmed={dimmed}
      data-lit={lit}
      data-settling={settling}
    >
      <Handle className="chain-chip__port" type="target" position={Position.Left} />
      <Handle className="chain-chip__port" type="source" position={Position.Right} />

      <span className="chain-chip__glyph" aria-hidden="true">
        {KIND_LABEL[record.kind].slice(0, 2)}
      </span>

      <span className="chain-chip__text">
        <span className="chain-chip__kind">{KIND_LABEL[record.kind]}</span>
        <span className="chain-chip__title">{record.title}</span>
        {(variant === 'monolith' || tier === 'near') && item?.detail && variant !== 'sediment' && (
          <span className="chain-chip__detail">{item.detail}</span>
        )}
      </span>

      {item && item.since !== '—' && variant !== 'sediment' && (
        <span className="chain-chip__since">{item.since}</span>
      )}

      {showActions && (
        <span className="chain-chip__actions">
          {item.actions.map((action) => (
            <button
              key={action.kind + action.label}
              type="button"
              className="chain-chip__action"
              onClick={(event) => {
                event.stopPropagation();
                onAct(action.kind);
              }}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
