/** One owner for label, @ref, #node-id and node.method wire addresses. */

import { componentFor } from '../components/registry.ts';
import type { CanvasNode, DiagramRecord, Endpoint } from '../../contract/records/index.ts';
import { slugify } from './slug.ts';

type WireReferenceNamespace = 'label' | 'ref' | 'id' | 'port';

/** The two authored halves of a method-qualified endpoint, when syntax is exact. */
export interface PortReferenceParts { node: string; method: string }

/** Parses exactly one interior dot. No other module may classify dotted endpoints. */
export function portReferenceParts(token: string): PortReferenceParts | undefined {
  const first = token.indexOf('.');
  if (first <= 0 || first !== token.lastIndexOf('.') || first === token.length - 1) return undefined;
  return { node: token.slice(0, first), method: token.slice(first + 1) };
}

/** Parses and namespaces an authored endpoint token without resolving it. */
export function wireReferenceKey(token: string): `${WireReferenceNamespace}:${string}` {
  if (token.startsWith('@')) return `ref:${token.slice(1)}`;
  if (token.startsWith('#')) return `id:${token.slice(1)}`;
  if (portReferenceParts(token)) return `port:${slugify(token)}`;
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

/** Canonical authored address for one stored endpoint, including a durable method ordinal. */
export function wireReferenceForEndpoint(
  record: Pick<DiagramRecord, 'nodes' | 'interfaces'>,
  endpoint: Endpoint,
): string | undefined {
  const node = record.nodes[endpoint.nodeId];
  if (!node) return undefined;
  if (!endpoint.anchor) return wireReferenceFor(node);
  const interfaceId = node.interfaceIds[endpoint.anchor.ordinal];
  const method = interfaceId ? record.interfaces[interfaceId] : undefined;
  return method ? `${node.label}.${method.name}` : undefined;
}

/** Quotes labels while leaving explicit @ref and #id addresses readable. */
export function printWireReference(reference: string): string {
  return reference.startsWith('@') || reference.startsWith('#') ? reference : `"${reference}"`;
}
