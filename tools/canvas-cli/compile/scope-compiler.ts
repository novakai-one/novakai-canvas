import type { ContainerArrangement, ParsedPresentation } from '../../../src/domain/canvas-presentation.ts';
import type { DiagramRecord } from '../../../src/domain/records.ts';
import type { NodeAst, ZoneAst } from '../dsl-ast.ts';
import type { RecordNode } from '../record-graph.ts';
import { asId } from '../record-graph.ts';
import { slugify } from '../../../src/authoring/slug.ts';
import type {
  CompileMessages, CompiledDiagram, CompiledScope, DeclaredScope,
} from './contract.ts';
import { NodeIdentityIndex } from './node-identity.ts';

type TreeRow = NonNullable<RecordNode['rows']>[number];

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
      id: asId(rootNodeId),
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
    this.warnMissingRowParents(nodeAst);
    const childContent = Object.fromEntries(
      Object.entries(nodeAst.children).filter(([, content]) => content.length > 0),
    );
    this.nodes[nodeId] = {
      id: asId(nodeId),
      kind: nodeAst.kind,
      label: nodeAst.label,
      ...(nodeAst.description ? { description: nodeAst.description } : {}),
      parentId: asId(parentId),
      ...(nodeAst.band === undefined ? {} : { band: nodeAst.band }),
      ...(nodeAst.lane === undefined ? {} : { lane: nodeAst.lane }),
      interfaceIds: interfaceIds.map((id) => asId(id)),
      typeIds: typeIds.map((id) => asId(id)),
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

  private warnMissingRowParents(node: NodeAst): void {
    const rows = (node.children.rows ?? []) as TreeRow[];
    const rowIds = new Set(rows.map((row) => row.id));
    for (const row of rows) {
      if (row.parentRowId && !rowIds.has(row.parentRowId)) {
        this.messages.warnings.push(
          `row "${row.id}" names missing parent "${row.parentRowId}" — rendered top-level`,
        );
      }
    }
  }

  private compileZone(zone: ZoneAst, parentId: string): string | undefined {
    const zoneId = this.identity.allocateZone(zone.label, parentId);
    if (!zoneId) return undefined;
    this.nodes[zoneId] = {
      id: asId(zoneId),
      kind: 'group',
      label: zone.label,
      ...(zone.description ? { description: zone.description } : {}),
      parentId: asId(parentId),
      interfaceIds: [],
      typeIds: [],
    };
    const childIds = this.compileDeclarations(zone.declarations, zoneId);
    this.storeArrangement(zoneId, zone.presentation, childIds);
    return zoneId;
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
