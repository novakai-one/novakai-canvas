import { componentFor } from '../../components/registry.ts';
import { orientationOf, resolveAxis, type Axis } from '../axis.ts';
import type { ContainerArrangement } from '../../../contract/schemas/presentation.ts';
import { resolveNodeAppearance } from '../node-appearance.ts';
import { laneRuler as computeLaneRuler, type LaneRuler } from '../lane-ruler.ts';
import { positionedNodes, resolveLayout } from '../layouts.ts';
import { compileFrameTopology, type Topology } from '../topology.ts';
import type {
  ArchitectureDocument, CanvasLayout, NodePlacement, PositionedCanvasNode, Size,
} from '../../../contract/records/legacy.ts';
import type { CanvasNode as RecordNode } from '../../../contract/records/index.ts';

type PositionedDocument = Omit<ArchitectureDocument, 'nodes'> & {
  nodes: Record<string, PositionedCanvasNode>;
};

export type LayoutNestedContainer = (containerId: string) => Size;

/** Resolves content requirements through the one saved auto/manual size authority. */
export function resolveRequiredSize(
  required: Size,
  placement: Pick<NodePlacement, 'size' | 'sizeMode'> | undefined,
): Size {
  if (placement?.sizeMode !== 'manual') return required;
  return {
    width: Math.max(required.width, placement.size.width),
    height: Math.max(required.height, placement.size.height),
  };
}

/** Mutable working state private to one deterministic geometry calculation. */
export class LayoutState {
  readonly document: PositionedDocument;
  readonly layout: CanvasLayout;
  readonly groupPadding: number;
  /** Resolved once, so no step downstream re-decides which way this diagram runs. */
  readonly axis: Axis;
  /** The frame the diagram declares, compiled once per run. Derived, never persisted. */
  readonly topology: Topology;
  private ruler: LaneRuler | undefined;

  private constructor(
    document: PositionedDocument,
    layout: CanvasLayout,
    groupPadding: number,
  ) {
    this.document = document;
    this.layout = layout;
    this.groupPadding = groupPadding;
    this.axis = resolveAxis(orientationOf(document));
    this.topology = compileFrameTopology(document.nodes);
  }

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

  /** The one across-axis ruler for this run, memoized; sizes come from the same measure used everywhere. */
  laneRuler(): LaneRuler {
    if (!this.ruler) {
      const sizes = Object.fromEntries([...this.topology.lanes.keys()]
        .map((nodeId) => [nodeId as string, this.measureNode(nodeId as string)]));
      this.ruler = computeLaneRuler(this.topology, sizes, this.axis);
    }
    return this.ruler;
  }

  measureNode(nodeId: string): Size {
    const node = this.document.nodes[nodeId];
    const placement = this.layout.placements[nodeId];
    const interfaceLines = node.interfaceIds.map((id) => {
      const item = this.document.interfaces[id];
      return `${item.name}(${item.accepts.join(', ')}) -> ${item.returns.join(', ')}`;
    });
    const typeLines = node.typeIds.map((id) => {
      const item = this.document.types[id];
      return `${item.name} { ${item.fields.join(', ')} }`;
    });
    const authored = this.layout.appearanceByNodeId?.[node.id];
    const required = componentFor(node.kind).measure(node as unknown as RecordNode, {
      interfaceLines,
      typeLines,
      appearance: resolveNodeAppearance(node.kind as RecordNode['kind'], authored),
    });
    return resolveRequiredSize(required, placement);
  }

  orderedDirectChildIds(containerId: string): string[] {
    const childIds = Object.keys(this.document.nodes)
      .filter((id) => this.document.nodes[id].parentId === containerId);
    return childIds.every((id) => componentFor(
      this.document.nodes[id].kind === 'scope' ? 'group' : this.document.nodes[id].kind,
    ).identity?.preserveDeclarationOrder)
      ? childIds : childIds.sort();
  }

  arrangementFor(containerId: string): ContainerArrangement | undefined {
    return this.layout.arrangementByContainerId?.[containerId];
  }

  isPinned(nodeId: string): boolean {
    return this.layout.placements[nodeId]?.pinned ?? false;
  }

  /** Whether any semantic wire connects two direct children in this candidate set. */
  hasInternalWire(childIds: readonly string[]): boolean {
    const children = new Set(childIds);
    return Object.values(this.document.wires).some((wire) =>
      children.has(wire.source) && children.has(wire.target));
  }
}
