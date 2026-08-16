import type { MessagesDesign } from '../../messages-design';
import { MessagesLedger } from './MessagesLedger';

export const correspondenceLedgerDesign = {
  id: 'ledger',
  label: 'Correspondence Ledger',
  ownsInspector: true,
  View: MessagesLedger,
} satisfies MessagesDesign;
