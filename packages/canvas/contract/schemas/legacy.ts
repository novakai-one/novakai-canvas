import { z } from 'zod';
import type { ArchitectureDocument } from '../records/legacy-document.ts';
import {
  architectureDocumentV2Schema, legacyArchitectureDocumentSchema,
} from './legacy-shapes.ts';

const DEFAULT_LAYOUT_ID = 'layout-default';

/** Parses current documents and losslessly migrates legacy node geometry into a layout. */
export function parseArchitectureDocument(input: unknown): ArchitectureDocument {
  const version = z.object({ schemaVersion: z.number() }).passthrough().parse(input).schemaVersion;
  if (version === 2) {
    const parsed = architectureDocumentV2Schema.parse(input);
    const diagrams = Object.keys(parsed.diagrams).length > 0 ? parsed.diagrams
      : Object.fromEntries(Object.values(parsed.nodes)
        .filter((node) => node.kind === 'scope' && !node.parentId)
        .map((node) => [node.id, {
          id: node.id, rootNodeId: node.id, status: 'active' as const, sourceRefs: [],
        }]));
    return { ...parsed, diagrams } as ArchitectureDocument;
  }
  const legacy = legacyArchitectureDocumentSchema.parse(input);
  return architectureDocumentV2Schema.parse({
    schemaVersion: 2, id: legacy.id, name: legacy.name, revision: legacy.revision,
    nodes: Object.fromEntries(Object.entries(legacy.nodes).map(([id, node]) => {
      const { position: _position, size: _size, ...meaning } = node;
      return [id, meaning];
    })),
    interfaces: legacy.interfaces, types: legacy.types, wires: legacy.wires,
    activeLayoutId: DEFAULT_LAYOUT_ID,
    layouts: {
      [DEFAULT_LAYOUT_ID]: {
        id: DEFAULT_LAYOUT_ID, name: 'Default', strategy: 'manual',
        placements: Object.fromEntries(Object.entries(legacy.nodes).map(([id, node]) => [id, {
          nodeId: id, position: node.position, size: node.size, pinned: false,
        }])),
        wireRouteHints: {}, collapsedNodeIds: [], appearanceByNodeId: {},
        appearanceByWireId: {}, arrangementByContainerId: {},
      },
    },
    diagrams: Object.fromEntries(Object.values(legacy.nodes)
      .filter((node) => node.kind === 'scope' && !node.parentId)
      .map((node) => [node.id, {
        id: node.id, rootNodeId: node.id, status: 'active', sourceRefs: [],
      }])),
    appliedOperations: {},
  }) as ArchitectureDocument;
}

/** Runtime validator and migration seam for architecture documents. */
export const architectureDocumentSchema = { parse: parseArchitectureDocument };
