import type { ComponentType } from 'react';
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import { ArchitectureNode } from './card/web.tsx';
import { CommentNode } from './comment/web.tsx';
import { ScopeNode } from './group/web.tsx';
import { TreeNode } from './tree/web.tsx';
import { TimelineNode } from './timeline/web.tsx';
import { MetricNode } from './metric/web.tsx';
import { IconCardNode } from './icon-card/web.tsx';
import { IconGridNode } from './icon-grid/web.tsx';
import { CalloutStackNode } from './callout-stack/web.tsx';
import { BlockNode } from './block/web.tsx';
import { OouxObjectNode } from './ooux-object/web.tsx';
import { EntityNode } from './entity/web.tsx';
import type { DiagramNode as CanvasNode } from '@novakai/canvas';
import type { ArchitectureNodeData } from '../presentation/projection.ts';
import { componentFor } from '@novakai/canvas';

function registeredRenderer<T extends Node<ArchitectureNodeData>>(
  kind: CanvasNode['kind'],
  Renderer: ComponentType<NodeProps<T>>,
) {
  const policy = componentFor(kind).resize;
  /** Registry-owned interaction chrome around a component-owned visual body. */
  return function registryOwnedRenderer(props: NodeProps<T>) {
    return <>
      {policy && <NodeResizer
        isVisible={props.data.editable && props.selected}
        minHeight={policy.minSize.height}
        minWidth={policy.minSize.width}
        onResizeEnd={() => props.data.resizeEnd?.(props.data.node.id as string)}
      />}
      <Renderer {...props} />
    </>;
  };
}

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
  group: registeredRenderer('group', ScopeNode),
  module: registeredRenderer('module', ArchitectureNode),
  object: registeredRenderer('object', ArchitectureNode),
  runtime: registeredRenderer('runtime', ArchitectureNode),
  resource: registeredRenderer('resource', ArchitectureNode),
  comment: registeredRenderer('comment', CommentNode),
  tree: registeredRenderer('tree', TreeNode),
  timeline: registeredRenderer('timeline', TimelineNode),
  metric: registeredRenderer('metric', MetricNode),
  'icon-card': registeredRenderer('icon-card', IconCardNode),
  'icon-grid': registeredRenderer('icon-grid', IconGridNode),
  'callout-stack': registeredRenderer('callout-stack', CalloutStackNode),
  block: registeredRenderer('block', BlockNode),
  'ooux-object': registeredRenderer('ooux-object', OouxObjectNode),
  entity: registeredRenderer('entity', EntityNode),
} satisfies Record<CanvasNode['kind'], ComponentType<NodeProps<never>>>;
