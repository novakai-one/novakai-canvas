/**
 * One conversation as typeset ink: column-head, turns, and the structural margin.
 *
 * No fills, no borders, no cards. Each turn is a three-column grid row — hanging
 * timestamp, dialogue, margin — so a citation always sits level with the sentence
 * that cited it. The amber chain and the reading lamp both live at row level here.
 */
import type { Node, NodeProps } from '@xyflow/react';
import { field } from '../../../../object-graph/graph';
import { FOLIO_ID, useLedgerUi } from './ledger-context';
import { MarginGloss } from './MarginGloss';
import { FolioPicker, LedgerComposer } from './LedgerComposer';

export type LedgerNodeData = { bandId: string };
export type LedgerNode = Node<LedgerNodeData, 'ledger-band'>;

export function LedgerBandNode({ data }: NodeProps<LedgerNode>) {
  const ui = useLedgerUi();

  if (data.bandId === FOLIO_ID) {
    return (
      <div className="ledger-band ledger-band--folio" data-tier={ui.tier}>
        <FolioPicker agents={ui.liveAgents} />
      </div>
    );
  }

  const band = ui.bandFor(data.bandId);
  if (!band) return null;

  const released = ui.releasedBandIds.includes(band.id);
  const agentName = band.agent?.title ?? 'Agent';
  const agentLive = band.agent ? field(band.agent, 'status') === 'live' : false;

  return (
    <div
      className="ledger-band"
      data-tier={ui.tier}
      data-active={ui.activeBandId === band.id}
      data-unread={band.unread}
      data-ghost={band.ghost}
      data-amber={Boolean(band.amber) && !released}
      data-released={Boolean(band.amber) && released}
      data-thread-pull={ui.threadPullBandId === band.id}
    >
      <header className="ledger-band__head">
        <span className="ledger-band__name">{agentName}</span>
        <span className="ledger-band__head-meta">
          {band.mission?.title ?? 'No mission'}
          {agentLive ? ' · live' : ''}
        </span>
      </header>

      {band.ghost && (
        <p className="ledger-band__ghost-note">Nothing written yet. The first line makes it real.</p>
      )}

      {band.turns.map((turn) => {
        const amberRow = band.amber?.messageId === turn.message.id;
        const lamp =
          ui.gloss?.bandId === band.id && ui.gloss.messageId === turn.message.id;
        return (
          <div key={turn.message.id}>
            {turn.timeRule && (
              <div className="ledger-timerule" style={{ marginTop: turn.gapPx }}>
                <span>{turn.timeRule}</span>
              </div>
            )}
            <div
              className="ledger-turn"
              data-mine={turn.mine}
              data-amber-row={amberRow}
              data-lamp={lamp}
              style={{ marginTop: turn.timeRule ? 16 : turn.gapPx }}
            >
              {amberRow && <span className="ledger-turn__thread-line" aria-hidden="true" />}
              <span className="ledger-turn__when">{turn.time}</span>
              <button
                type="button"
                className="ledger-turn__body"
                onClick={(event) => {
                  event.stopPropagation();
                  ui.selectRow(band.id, turn.message.id);
                }}
              >
                <span className="ledger-turn__speaker">{turn.speaker}</span>
                {field(turn.message, 'body')}
              </button>
              <div className="ledger-turn__margin">
                {turn.citations.map((record) => (
                  <MarginGloss
                    key={record.id}
                    record={record}
                    bandId={band.id}
                    messageId={turn.message.id}
                    amber={band.amber?.citationId === record.id}
                    released={released}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {ui.activeBandId === band.id && (
        <div className="ledger-band__composer-row">
          <LedgerComposer bandId={band.id} agentName={agentName} />
        </div>
      )}
    </div>
  );
}
