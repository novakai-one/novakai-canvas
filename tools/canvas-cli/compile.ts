/** Compiles parsed scope ASTs into diagram-record content, one record per scope block. */

import type { CrossDiagramLink, DiagramRecord } from '../../src/canvas.ts';
import { componentFor } from '../../src/components/registry.ts';
import type { ScopeAst } from './dsl-ast.ts';
import type {
  CompileMessages, CompileResult, DeclaredScope, ForeignCatalog,
} from './compile/contract.ts';
import { compileScope } from './compile/scope-compiler.ts';
import { compileScopeWires } from './compile/wire-compiler.ts';
import { rootGroupId } from './record-graph.ts';
import { slugify } from './slug.ts';
import type { LinkEnd } from './wire-authoring.ts';

export type {
  CompileError, CompiledDiagram, CompileResult,
} from './compile/contract.ts';
export type { CrossDiagramWire, LinkEnd } from './wire-authoring.ts';

function existingRecordFor(
  existing: Record<string, DiagramRecord>,
  label: string,
): DiagramRecord | undefined {
  const wanted = slugify(label);
  return existing[wanted]
    ?? Object.values(existing).find((record) => slugify(record.name) === wanted);
}

function declareScopes(
  scopes: ScopeAst[],
  existing: Record<string, DiagramRecord>,
): { declared: Map<string, DeclaredScope>; createdDiagramIds: string[] } {
  const declared = new Map<string, DeclaredScope>();
  const createdDiagramIds: string[] = [];
  for (const scopeAst of scopes) {
    const record = existingRecordFor(existing, scopeAst.label);
    const slug = slugify(scopeAst.label);
    const id = (record?.id as string | undefined) ?? slug;
    const rootNodeId = (record && rootGroupId(record)) ?? slug;
    declared.set(id, { scopeAst, record, id, rootNodeId });
    if (!record) createdDiagramIds.push(id);
  }
  return { declared, createdDiagramIds };
}

function foreignCatalog(
  existing: Record<string, DiagramRecord>,
  selfIds: Set<string>,
): ForeignCatalog {
  const ends = new Map<string, LinkEnd[]>();
  const labels = new Map<string, string>();
  for (const record of Object.values(existing)) {
    if (selfIds.has(record.id as string)) continue;
    for (const node of Object.values(record.nodes)) {
      const address = componentFor(node.kind).identity?.wireAddress;
      if (address === false || (address && address !== 'label')) continue;
      const slug = slugify(node.label);
      labels.set(slug, node.label);
      ends.set(slug, [...(ends.get(slug) ?? []), {
        diagramId: record.id as string,
        nodeId: node.id as string,
      }]);
    }
  }
  return { ends, labels };
}

/**
 * Compiles complete scope declarations while preserving durable identities from existing maps.
 * Local and cross-diagram relationships resolve only after each scope's nodes are known.
 */
export function compile(
  scopes: ScopeAst[],
  existing: Record<string, DiagramRecord>,
  links: CrossDiagramLink[] = [],
): CompileResult {
  const messages: CompileMessages = { errors: [], warnings: [] };
  const { declared, createdDiagramIds } = declareScopes(scopes, existing);
  const foreign = foreignCatalog(existing, new Set(declared.keys()));
  const diagrams = [];
  for (const declaration of declared.values()) {
    const compiled = compileScope(declaration, messages);
    compileScopeWires(compiled, { foreign, links, messages });
    diagrams.push(compiled.diagram);
  }
  return {
    diagrams,
    errors: messages.errors,
    warnings: messages.warnings,
    createdDiagramIds,
  };
}
