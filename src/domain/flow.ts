/** One stored direction shared by layout and rendering adapters. */
export const ARCHITECTURE_FLOW = {
  rankDirection: 'TB',
  sourcePort: 'bottom',
  targetPort: 'top',
} as const;

/**
 * The sides a node offers a wire, in the order they are rendered.
 *
 * `ARCHITECTURE_FLOW` still names the pair the *router* prefers when nothing else is stored;
 * this names every side a *hand* may use. They are separate facts: the default flow direction
 * is a layout opinion, while the port set is what the interaction allows.
 */
export const NODE_PORTS = ['top', 'right', 'bottom', 'left'] as const;

export type NodePort = typeof NODE_PORTS[number];
