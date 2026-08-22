/** Universal selection reference for inspectors. */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'interface'; id: string }
  | { kind: 'type'; id: string }
  | { kind: 'wire'; id: string }
  | { kind: 'component-item'; nodeId: string; collection: string; itemId: string }
  | null;
