import type { MessagesDesign } from './messages-design';
import { currentMessagesDesign } from './designs/current';

export const DEFAULT_MESSAGES_DESIGN_ID = currentMessagesDesign.id;

const designs: readonly MessagesDesign[] = [
  currentMessagesDesign,
];

export function listMessagesDesigns(): readonly MessagesDesign[] {
  return designs;
}

/** Unknown and missing design IDs deliberately fall back to the registered default. */
export function resolveMessagesDesign(search: string): MessagesDesign {
  const requestedId = new URLSearchParams(search).get('messagesDesign');
  return designs.find((design) => design.id === requestedId) ?? currentMessagesDesign;
}
