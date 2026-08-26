import type { NodeAst } from '../dsl-ast.ts';
import type { RecordNode } from '../records/record-graph.ts';
import type { CompileMessages } from './contract.ts';

type TreeRow = NonNullable<RecordNode['rows']>[number];

/** Preserves the tolerant tree-row diagnostic during scope compilation. */
export function warnMissingRowParents(node: NodeAst, messages: CompileMessages): void {
  const rows = (node.children.rows ?? []) as TreeRow[];
  const rowIds = new Set(rows.map((row) => row.id));
  for (const row of rows) {
    if (row.parentRowId && !rowIds.has(row.parentRowId)) {
      messages.warnings.push(
        `row "${row.id}" names missing parent "${row.parentRowId}" — rendered top-level`,
      );
    }
  }
}
