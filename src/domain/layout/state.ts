import { componentFor } from '../../components/registry.ts';
import type { CanvasNode as RecordNode } from '../records.ts';
import { resolveNodeAppearance, type ContainerArrangement } from '../canvas-presentation.ts';
import type {
  ArchitectureDocument, CanvasLayout, PositionedCanvasNode, Size,
} from '../model.ts';
import { positionedNodes, resolveLayout } from '../layouts.ts';

type PositionedDocument = Omit<ArchitectureDocument, 'nodes'> & {
  nodes: Record<string, PositionedCanvasNode>;
};

/** Recursive container call supplied by the dispatcher to both layout policies. */
export type LayoutNestedContainer = (containerId: string) => Size;

/** Concrete mutable state owned only by one in-progress layout calculation. */
export class LayoutState {
  readonly document: PositionedDocument;
  readonly layout: CanvasLayout;
  readonly groupPadding: number;

  private constructor(
    document: PositionedDocument,
    layout: CanvasLayout,
    groupPadding: number,
  ) {
    this.document = document;
    this.layout = layout;
    this.groupPadding = groupPadding;
  }

  /** Creates an isolated positioned working copy for exactly one selected layout. */
  static create(
    input: ArchitectureDocument,
    layoutId: string | undefined,
    requestedGroupPadding: number,
  ): LayoutState {
    const layout = resolveLayout(input, layoutId);
    return new LayoutState(
      { ...input, nodes: positionedNodes(input, layout.id) },
      layout,
      Math.min(160, Math.max(16, requestedGroupPadding)),
    );
  }

  /** Measures one leaf through its registered component and selected-layout appearance. */
  measureNode(nodeId: string): Size {
    const node = this.document.nodes[nodeId];
    const interfaceLines = node.interfaceIds.map((id) => {
      const item = this.document.interfaces[id];
      return `${item.name}(${item.accepts.join(', ')}) -> ${item.returns.join(', ')}`;
    });
    const typeLines = node.typeIds.map((id) => {
      const item = this.document.types[id];
      return `${item.name} { ${item.fields.join(', ')} }`;
    });
    const authored = this.layout.appearanceByNodeId?.[node.id];
    return componentFor(node.kind).measure(node as unknown as RecordNode, {
      interfaceLines,
      typeLines,
      appearance: resolveNodeAppearance(node.kind as RecordNode['kind'], authored),
    });
  }

  /** Returns direct children in the ordering declared by their registered identity policy. */
  orderedDirectChildIds(containerId: string): string[] {
    const childIds = Object.keys(this.document.nodes)
      .filter((id) => this.document.nodes[id].parentId === containerId);
    return childIds.every((id) => componentFor(
      this.document.nodes[id].kind === 'scope' ? 'group' : this.document.nodes[id].kind,
    ).identity?.preserveDeclarationOrder)
      ? childIds : childIds.sort();
  }

  /** Reads authored arrangement from the selected layout only. */
  arrangementFor(containerId: string): ContainerArrangement | undefined {
    return this.layout.arrangementByContainerId?.[containerId];
  }

  /** Reads the selected layout's pin, defaulting absent placements to unpinned. */
  isPinned(nodeId: string): boolean {
    return this.layout.placements[nodeId]?.pinned ?? false;
  }
}
