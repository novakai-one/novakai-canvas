/**
 * The ledger's interior wiring, passed by context so React Flow node data stays a
 * stable `{ bandId }` and every interaction lives in one place (MessagesLedger).
 */
import { createContext, useContext } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { LedgerBand } from './ledger-model';
import type { LedgerTier } from './ledger-camera';

export type LedgerGloss = {
  readonly bandId: string;
  readonly messageId: string;
  readonly citationId: string;
};

export type LedgerUi = {
  bandFor(bandId: string): LedgerBand | undefined;
  readonly tier: LedgerTier;
  readonly activeBandId: string | null;
  readonly gloss: LedgerGloss | null;
  readonly threadPullBandId: string | null;
  /** Bands whose amber chain has visibly drained to settled sage this session. */
  readonly releasedBandIds: readonly string[];
  readonly liveAgents: readonly ObjectRecord[];
  roleOf(agent: ObjectRecord): string;

  openGloss(gloss: LedgerGloss): void;
  closeGloss(): void;
  inspect(id: string): void;
  openRecord(record: ObjectRecord): void;
  selectRow(bandId: string, messageId: string): void;
  send(bandId: string, body: string): void;
  pickAgent(agent: ObjectRecord): void;
};

export const LedgerUiContext = createContext<LedgerUi | null>(null);

export function useLedgerUi(): LedgerUi {
  const ui = useContext(LedgerUiContext);
  if (!ui) throw new Error('useLedgerUi must be used inside MessagesLedger');
  return ui;
}

/** The pseudo-band appended while a new conversation is being started. */
export const FOLIO_ID = '__folio__';
