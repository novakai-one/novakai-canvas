import type { ContainerArrangement, ParsedPresentation } from '../../../contract/schemas/presentation.ts';
import type { InterfaceId, NodeId, TypeId } from '../../../contract/brands.ts';
import type { DiagramRecord } from '../../../contract/records/index.ts';
import type { NodeAst, ZoneAst } from '../dsl-ast.ts';
import type { RecordNode } from '../records/record-graph.ts';
import { asId } from '../records/record-graph.ts';
import { slugify } from '../slug.ts';
import type {
  CompileMessages, CompiledDiagram, CompiledScope, DeclaredScope,
} from './contract.ts';
import { NodeIdentityIndex } from './node-identity.ts';
import { warnMissingRowParents } from './scope-warnings.ts';

class ScopeCompiler {
  private readonly declared: DeclaredScope;
  private readonly messages: CompileMessages;
  private readonly nodes: Record<string, RecordNode> = {};
  private readonly interfaces: DiagramRecord['interfaces'] = {};
  private readonly types: DiagramRecord['types'] = {};
  private readonly appearanceByNodeId: CompiledDiagram['appearanceByNodeId'] = {};
  private readonly appearanceByWireId: CompiledDiagram['appearanceByWireId'] = {};
  private readonly arrangementByContainerId: CompiledDiagram['arrangementByContainerId'] = {};
  private readonly identity: NodeIdentityIndex;

  constructor(declared: DeclaredScope, messages: CompileMessages) {
    this.declared = declared;
    this.messages = messages;
    this.identity = new NodeIdentityIndex(declared, messages);
  }

  compile(): CompiledScope {
    const { scopeAst, rootNodeId, id } = this.declared;
    this.nodes[rootNodeId] = {
      id: asId<NodeId>(rootNodeId),
      kind: 'group',
      label: scopeAst.label,
      ...(scopeAst.description ? { description: scopeAst.description } : {}),
      interfaceIds: [],
      typeIds: [],
    };
    const rootChildIds = this.compileDeclarations(scopeAst.declarations, rootNodeId);
    this.storeArrangement(rootNodeId, scopeAst.presentation, rootChildIds);
    return {
      declared: this.declared,
      endpointByLabelSlug: this.identity.endpointByLabelSlug,
      endpointByRef: this.identity.endpointByRef,
      endpointById: this.identity.endpointById,
      localLabels: this.identity.localLabels,
      diagram: {
        id,
        name: scopeAst.label,
        ...(scopeAst.orientation === undefined ? {} : { orientation: scopeAst.orientation }),
        rootNodeId,
        nodes: this.nodes,
        wires: {},
        flows: {},
        interfaces: this.interfaces,
        types: this.types,
        appearanceByNodeId: this.appearanceByNodeId,
        appearanceByWireId: this.appearanceByWireId,
        arrangementByContainerId: this.arrangementByContainerId,
        crossDiagramWires: [],
      },
    };
  }

  private compileDeclarations(declarations: (NodeAst | ZoneAst)[], parentId: string): string[] {
    const compiledIds: string[] = [];
    for (const declaration of declarations) {
      const nodeId = 'kind' in declaration
        ? this.compileNode(declaration, parentId)
        : this.compileZone(declaration, parentId);
      if (nodeId) compiledIds.push(nodeId);
    }
    return compiledIds;
  }

  private compileNode(nodeAst: NodeAst, parentId: string): string | undefined {
    const allocated = this.identity.allocateNode(nodeAst, parentId);
    if (!allocated) return undefined;
    const { nodeId } = allocated;
    const interfaceIds = this.compileInterfaces(nodeAst, nodeId);
    const typeIds = this.compileTypes(nodeAst, nodeId);
    warnMissingRowParents(nodeAst, this.messages);
    const childContent = Object.fromEntries(
      Object.entries(nodeAst.children).filter(([, content]) => content.length > 0),
    );
    this.nodes[nodeId] = {
      id: asId<NodeId>(nodeId),
      kind: nodeAst.kind,
      label: nodeAst.label,
      ...(nodeAst.description ? { description: nodeAst.description } : {}),
      parentId: asId<NodeId>(parentId),
      ...(nodeAst.band === undefined ? {} : { band: nodeAst.band }),
      ...(nodeAst.lane === undefined ? {} : { lane: nodeAst.lane }),
      interfaceIds: interfaceIds.map((id) => asId<InterfaceId>(id)),
      typeIds: typeIds.map((id) => asId<TypeId>(id)),
      ...nodeAst.content,
      ...childContent,
    };
    if (nodeAst.presentation?.appearance
      && Object.keys(nodeAst.presentation.appearance).length > 0) {
      this.appearanceByNodeId[nodeId] = nodeAst.presentation.appearance;
    }
    return nodeId;
  }

  private compileInterfaces(node: NodeAst, nodeId: string): string[] {
    const ids: string[] = [];
    for (const item of node.interfaces) {
      let id = `${nodeId}--if-${slugify(item.name)}`;
      while (this.interfaces[id]) id += '-x';
      this.interfaces[id] = {
        id, ownerId: nodeId, name: item.name, accepts: item.accepts, returns: item.returns,
      };
      ids.push(id);
    }
    return ids;
  }

  private compileTypes(node: NodeAst, nodeId: string): string[] {
    const ids: string[] = [];
    for (const item of node.types) {
      let id = `${nodeId}--type-${slugify(item.name)}`;
      while (this.types[id]) id += '-x';
      this.types[id] = { id, name: item.name, fields: item.fields };
      ids.push(id);
    }
    return ids;
  }

  private compileZone(zone: ZoneAst, parentId: string): string | undefined {
    const zoneId = this.identity.allocateZone(zone.label, parentId);
    if (!zoneId) return undefined;
    this.nodes[zoneId] = {
      id: asId<NodeId>(zoneId),
      kind: 'group',
      label: zone.label,
      ...(zone.description ? { description: zone.description } : {}),
      parentId: asId<NodeId>(parentId),
      interfaceIds: [],
      typeIds: [],
    };
    const childIds = this.compileDeclarations(zone.declarations, zoneId);
    const gate = this.resolveGate(zone);
    this.nodes[zoneId] = {
      ...this.nodes[zoneId],
      ...(zone.crossing === undefined ? {} : { crossing: zone.crossing }),
      ...(gate === undefined ? {} : { gate: asId<NodeId>(gate) }),
    };
    this.storeArrangement(zoneId, zone.presentation, childIds);
    return zoneId;
  }

  private resolveGate(zone: ZoneAst): string | undefined {
    if (zone.gateLabel === undefined) return undefined;
    const matches = this.identity.endpointByLabelSlug.get(slugify(zone.gateLabel)) ?? [];
    if (matches.length === 1) return matches[0];
    this.messages.errors.push(matches.length === 0 ? {
      message: `zone "${zone.label}": no node named "${zone.gateLabel}" in this map`,
      hint: 'name a node declared inside this zone',
    } : {
      message: `zone "${zone.label}": node name "${zone.gateLabel}" is ambiguous`,
      hint: 'give the intended gate a unique label',
    });
    return undefined;
  }

  private storeArrangement(
    containerId: string,
    presentation: ParsedPresentation | undefined,
    childIds: string[],
  ): void {
    if (!presentation?.arrangement) return;
    const authored = presentation.arrangement;
    const arrangement: ContainerArrangement = {
      layout: authored.layout,
      childIds,
      gap: authored.gap,
      align: authored.align,
      ...(authored.columns === undefined ? {} : { columns: authored.columns }),
    };
    this.arrangementByContainerId[containerId] = arrangement;
  }

}

/** Compiles one scope's nodes, members, identities and presentation without resolving wires. */
export function compileScope(
  declared: DeclaredScope,
  messages: CompileMessages,
): CompiledScope {
  return new ScopeCompiler(declared, messages).compile();
}
