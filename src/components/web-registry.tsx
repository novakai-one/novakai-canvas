import type { ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';
import { ArchitectureNode } from '../presentation/nodes/architecture-node.tsx';
import { CommentNode } from '../presentation/nodes/comment-node.tsx';
import { ScopeNode } from '../presentation/nodes/scope-node.tsx';
import { TreeNode } from '../presentation/nodes/tree-node.tsx';
import { TimelineNode } from './timeline/web.tsx';
import { MetricNode } from './metric/web.tsx';
import { IconCardNode } from './icon-card/web.tsx';
import { CalloutStackNode } from './callout-stack/web.tsx';
import type { CanvasNode } from '../domain/records.ts';

/**
 * kind -> React Flow node component. Card kinds share `ArchitectureNode`; everything else gets
 * its own renderer.
 *
 * Typed as `Record<CanvasNode['kind'], ...>` rather than `Record<string, ...>` so registering a
 * kind on the core registry (`registry.ts`, pinned to the same `CanvasNode['kind']` union)
 * without giving it a web renderer here fails the typecheck instead of failing silently at
 * runtime when React Flow meets an unknown node type.
 *
 * `satisfies`, not a `: Record<...>` annotation, so each entry keeps the narrow component type
 * TypeScript infers (each renderer below is typed against its own `NodeProps<Node<Data,
 * '...'>>`) instead of widening to the loose shape the `Record<CanvasNode['kind'], ...>` check
 * needs — a `: Record<...>`-annotated object here stops being assignable to React Flow's
 * `nodeTypes` prop. `satisfies` still requires every key present with no extras, so it's the
 * completeness pin either way: drop a kind, or misspell one, and this line fails to typecheck.
 */
export const webRenderers = {
  group: ScopeNode,
  module: ArchitectureNode,
  object: ArchitectureNode,
  runtime: ArchitectureNode,
  resource: ArchitectureNode,
  comment: CommentNode,
  tree: TreeNode,
  timeline: TimelineNode,
  metric: MetricNode,
  'icon-card': IconCardNode,
  'callout-stack': CalloutStackNode,
} satisfies Record<CanvasNode['kind'], ComponentType<NodeProps<never>>>;
