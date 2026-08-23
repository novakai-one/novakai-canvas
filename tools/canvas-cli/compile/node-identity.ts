/** Stable node IDs and author-facing endpoint indexes for one compiled scope. */

import { componentFor } from '../../../src/components/registry.ts';
import type { NodeAst } from '../dsl-ast.ts';
import { descendantIds } from '../record-graph.ts';
import { slugify } from '../../../src/authoring/slug.ts';
import type { CompileMessages, DeclaredScope } from './contract.ts';

export interface AllocatedNode {
  nodeId: string;
  labelSlug: string;
}

/** Owns every identity namespace used while compiling one scope. */
export class NodeIdentityIndex {
  readonly endpointByLabelSlug = new Map<string, string[]>();
  readonly endpointByRef = new Map<string, string>();
  readonly endpointById = new Map<string, string>();
  readonly localLabels = new Map<string, string>();
  private readonly oldIdBySlug = new Map<string, string>();
  private readonly oldIdByParentIdentity = new Map<string, string>();
  private readonly parentIdentityKeys = new Set<string>();
  private readonly declared: DeclaredScope;
  private readonly messages: CompileMessages;
  private commentCount = 0;

  constructor(declared: DeclaredScope, messages: CompileMessages) {
    this.declared = declared;
    this.messages = messages;
    const { record, rootNodeId } = declared;
    if (!record) return;
    for (const nodeId of descendantIds(record, rootNodeId)) {
      const node = record.nodes[nodeId];
      const identity = componentFor(node.kind).identity;
      const keyValue = identity?.keyField && typeof node[identity.keyField] === 'string'
        ? node[identity.keyField] as string : node.label;
      if (identity?.scope === 'parent' && node.parentId) {
        this.oldIdByParentIdentity.set(
          `${identity.namespace}\u0000${node.parentId}\u0000${slugify(keyValue)}`,
          nodeId,
        );
      } else this.oldIdBySlug.set(slugify(node.label), nodeId);
    }
  }

  /** Allocates a leaf node ID and indexes it when it is a valid wire endpoint. */
  allocateNode(node: NodeAst, parentId: string): AllocatedNode | undefined {
    const component = componentFor(node.kind);
    const identity = component.identity;
    const isComment = node.kind === 'comment';
    const labelSlug = isComment
      ? `note-${(this.commentCount += 1)}-${slugify(node.label).slice(0, 24)}`
      : slugify(node.label);
    const keyValue = identity?.keyField && typeof node.content[identity.keyField] === 'string'
      ? node.content[identity.keyField] as string : node.label;
    const address = identity?.wireAddress;
    const reference = typeof address === 'object' ? node.content[address.field] : undefined;
    if (typeof reference === 'string' && reference.length > 0 && this.endpointByRef.has(reference)) {
      this.messages.errors.push({
        message: `duplicate ref "${reference}" in map "${this.declared.scopeAst.label}"`,
        hint: `${component.dslKeyword} refs must be unique within one map; use ref=another-name`,
      });
      return undefined;
    }
    const parentKey = identity?.scope === 'parent'
      ? `${identity.namespace}\u0000${parentId}\u0000${slugify(keyValue)}` : undefined;
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
        ?? `${parentId}--${identity!.namespace}-${slugify(keyValue)}`
      : this.oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
    if (address !== false) {
      this.endpointById.set(nodeId, nodeId);
      this.endpointByLabelSlug.set(
        labelSlug,
        [...(this.endpointByLabelSlug.get(labelSlug) ?? []), nodeId],
      );
    }
    if (address && address !== 'label') {
      if (typeof reference === 'string' && reference.length > 0) {
        this.endpointByRef.set(reference, nodeId);
      }
    }
    return { nodeId, labelSlug };
  }

  /** Allocates a map-wide unique container identity and indexes it as a wire endpoint. */
  allocateZone(label: string, parentId: string): string | undefined {
    const labelSlug = slugify(label);
    if (this.localLabels.has(labelSlug)) {
      this.duplicateLabel(label);
      return undefined;
    }
    this.localLabels.set(labelSlug, label);
    const zoneId = this.oldIdBySlug.get(labelSlug) ?? `${parentId}--${labelSlug}`;
    this.endpointByLabelSlug.set(
      labelSlug,
      [...(this.endpointByLabelSlug.get(labelSlug) ?? []), zoneId],
    );
    this.endpointById.set(zoneId, zoneId);
    return zoneId;
  }

  private duplicateLabel(label: string): void {
    this.messages.errors.push({
      message: `duplicate label "${label}" in map "${this.declared.scopeAst.label}"`,
      hint: 'labels must be unique within a map — wires resolve endpoints by label',
    });
  }
}
