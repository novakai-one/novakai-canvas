import { componentFor } from '../../../src/components/registry.ts';
import type { ContainerArrangement, ParsedPresentation } from '../../../src/domain/canvas-presentation.ts';
import type { DiagramRecord } from '../../../src/domain/records.ts';
import type { NodeAst, ZoneAst } from '../dsl-ast.ts';
import type { RecordNode } from '../record-graph.ts';
import { asId, descendantIds } from '../record-graph.ts';
import { slugify } from '../slug.ts';
import type {
  CompileMessages, CompiledDiagram, CompiledScope, DeclaredScope,
} from './contract.ts';

type TreeRow = NonNullable<RecordNode['rows']>[number];

interface AllocatedNode {
  nodeId: string;
  labelSlug: string;
}

class ScopeCompiler {
  private readonly declared: DeclaredScope;
  private readonly messages: CompileMessages;
  private readonly nodes: Record<string, RecordNode> = {};
  private readonly interfaces: DiagramRecord['interfaces'] = {};
  private readonly types: DiagramRecord['types'] = {};
  private readonly appearanceByNodeId: CompiledDiagram['appearanceByNodeId'] = {};
  private readonly arrangementByContainerId: CompiledDiagram['arrangementByContainerId'] = {};
  private readonly oldIdBySlug = new Map<string, string>();
  private readonly oldIdByParentIdentity = new Map<string, string>();
  private readonly endpointByLabelSlug = new Map<string, string>();
  private readonly localLabels = new Map<string, string>();
  private readonly parentIdentityKeys = new Set<string>();
  private commentCount = 0;

  constructor(declared: DeclaredScope, messages: CompileMessages) {
    this.declared = declared;
    this.messages = messages;
  }

  compile(): CompiledScope {
    this.indexExistingIdentities();
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
      endpointByLabelSlug: this.endpointByLabelSlug,
      localLabels: this.localLabels,
      diagram: {
        id,
        name: scopeAst.label,
        rootNodeId,
        nodes: this.nodes,
        wires: {},
        interfaces: this.interfaces,
        types: this.types,
        appearanceByNodeId: this.appearanceByNodeId,
        arrangementByContainerId: this.arrangementByContainerId,
        crossDiagramWires: [],
      },
    };
  }

  private indexExistingIdentities(): void {
    const { record, rootNodeId } = this.declared;
    if (!record) return;
    for (const nodeId of descendantIds(record, rootNodeId)) {
      const node = record.nodes[nodeId];
      const identity = componentFor(node.kind).identity;
      if (identity?.scope === 'parent' && node.parentId) {
        this.oldIdByParentIdentity.set(
          `${identity.namespace}\u0000${node.parentId}\u0000${slugify(node.label)}`,
          nodeId,
        );
      } else this.oldIdBySlug.set(slugify(node.label), nodeId);
    }
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

  private allocateNode(node: NodeAst, parentId: string): AllocatedNode | undefined {
    const component = componentFor(node.kind);
    const identity = component.identity;
    const isComment = node.kind === 'comment';
    const labelSlug = isComment
      ? `note-${(this.commentCount += 1)}-${slugify(node.label).slice(0, 24)}`
      : slugify(node.label);
    const parentKey = identity?.scope === 'parent'
      ? `${identity.namespace}\u0000${parentId}\u0000${slugify(node.label)}` : undefined;
    if (parentKey && this.parentIdentityKeys.has(parentKey)) {
      this.messages.errors.push({
        message: `duplicate sibling ${component.dslKeyword} label "${node.label}" in map "${this.declared.scopeAst.label}"`,
        hint: `${component.dslKeyword} labels must be unique within one parent`,
      });
      return undefined;
    }
    if (!identity && !isComment && this.localLabels.has(labelSlug)) {
      this.duplicateLabel(node.label);
      return undefined;
    }
    if (parentKey) this.parentIdentityKeys.add(parentKey);
    if (!identity && !isComment) this.localLabels.set(labelSlug, node.label);
    const nodeId = parentKey
      ? this.oldIdByParentIdentity.get(parentKey)
        ?? `${parentId}--${identity!.namespace}-${slugify(node.label)}`
      : this.oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
    if (identity?.wireEndpoint !== false) this.endpointByLabelSlug.set(labelSlug, nodeId);
    return { nodeId, labelSlug };
  }

  private compileNode(nodeAst: NodeAst, parentId: string): string | undefined {
    const allocated = this.allocateNode(nodeAst, parentId);
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
    const labelSlug = slugify(zone.label);
    if (this.localLabels.has(labelSlug)) {
      this.duplicateLabel(zone.label);
      return undefined;
    }
    this.localLabels.set(labelSlug, zone.label);
    const zoneId = this.oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
    this.endpointByLabelSlug.set(labelSlug, zoneId);
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

  private duplicateLabel(label: string): void {
    this.messages.errors.push({
      message: `duplicate label "${label}" in map "${this.declared.scopeAst.label}"`,
      hint: 'labels must be unique within a map — wires resolve endpoints by label',
    });
  }
}

/** Compiles one scope's nodes, members, identities and presentation without resolving wires. */
export function compileScope(
  declared: DeclaredScope,
  messages: CompileMessages,
): CompiledScope {
  return new ScopeCompiler(declared, messages).compile();
}
