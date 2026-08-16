import { createDesignRegistry } from '../../designs/design-registry';
import type { MessagesDesign } from './messages-design';
import { currentMessagesDesign } from './designs/current';
import { correspondenceLedgerDesign } from './designs/ledger';
import { transcriptAtlasDesign } from './designs/atlas';
import { relayRiverDesign } from './designs/relay-river';
import { signalOrreryDesign } from './designs/signal-orrery';
import { standingWaveDesign } from './designs/standing-wave';
import { catenaryDesign } from './designs/catenary';
import { vigilDesign } from './designs/vigil';
import { switchboardDesign } from './designs/switchboard';

/** The design selected whenever the URL requests no known Messages design. */
const DEFAULT_MESSAGES_DESIGN_ID = currentMessagesDesign.id;

const designs: readonly MessagesDesign[] = [
  currentMessagesDesign,
  correspondenceLedgerDesign,
  transcriptAtlasDesign,
  relayRiverDesign,
  signalOrreryDesign,
  standingWaveDesign,
  catenaryDesign,
  vigilDesign,
  switchboardDesign,
];

const messagesDesignRegistry = createDesignRegistry(
  designs,
  DEFAULT_MESSAGES_DESIGN_ID,
);

/** Lists every Messages design available to the Room selector. */
export function listMessagesDesigns(): readonly MessagesDesign[] {
  return messagesDesignRegistry.list();
}

/** Unknown and missing design IDs deliberately fall back to the registered default. */
export function resolveMessagesDesign(search: string): MessagesDesign {
  const requestedId = new URLSearchParams(search).get('messagesDesign');
  return messagesDesignRegistry.resolve(requestedId);
}
