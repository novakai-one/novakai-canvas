/** One owner for label, @ref and #node-id wire addresses. */

import { componentFor } from '../../src/components/registry.ts';
import type { CanvasNode } from '../../src/domain/records.ts';
import { slugify } from './slug.ts';

type WireReferenceNamespace = 'label' | 'ref' | 'id';

/** Parses and namespaces an authored endpoint token without resolving it. */
export function wireReferenceKey(token: string): `${WireReferenceNamespace}:${string}` {
  if (token.startsWith('@')) return `ref:${token.slice(1)}`;
  if (token.startsWith('#')) return `id:${token.slice(1)}`;
  return `label:${slugify(token)}`;
}

/** Lossless canonical address for a local stored endpoint. */
export function wireReferenceFor(node: CanvasNode): string | undefined {
  const address = componentFor(node.kind).identity?.wireAddress;
  if (address === false) return undefined;
  if (address && address !== 'label') {
    const value = node[address.field];
    return typeof value === 'string' && value.length > 0 ? `@${value}` : `#${node.id}`;
  }
  return node.label;
}

/** Quotes labels while leaving explicit @ref and #id addresses readable. */
export function printWireReference(reference: string): string {
  return reference.startsWith('@') || reference.startsWith('#') ? reference : `"${reference}"`;
}
