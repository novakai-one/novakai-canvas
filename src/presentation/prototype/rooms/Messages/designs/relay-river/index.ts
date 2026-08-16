import type { MessagesDesign } from '../../messages-design';
import { MessagesRelayRiver } from './MessagesRelayRiver';

/** The calibrated Relay River alternative for the Messages Room. */
export const relayRiverDesign = {
  id: 'relay-river',
  label: 'Relay River',
  ownsInspector: true,
  View: MessagesRelayRiver,
} satisfies MessagesDesign;
