/** Current V3 semantic node kinds; registration is compile-time pinned to this union. */
export type NodeKind =
  | 'group' | 'module' | 'object' | 'runtime' | 'resource' | 'comment' | 'tree'
  | 'timeline' | 'metric' | 'icon-card' | 'callout-stack' | 'block' | 'ooux-object'
  | 'entity';
