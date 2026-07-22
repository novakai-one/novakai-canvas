import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { TreeRow } from '../../domain/model';
import { orderedTreeRows, treeRowDepth } from '../../domain/tree';
import type { ArchitectureNodeData } from '../projection';

type TreeFlowNode = Node<ArchitectureNodeData, 'tree'>;

/** Status → visual tone; projects and buckets carry their own treatment. */
function rowTone(row: TreeRow): string {
  if (row.kind === 'project') return 'tone-project';
  if (row.kind === 'bucket') return 'tone-bucket';
  if (row.status === 'done') return 'tone-done';
  if (row.status === 'in-progress') return 'tone-active';
  if (row.status === 'todo' || row.status === 'retired') return 'tone-muted';
  return 'tone-tombstone';
}

/** Hierarchy renderer: every row is a selectable domain block. */
export function TreeNode({ data, selected }: NodeProps<TreeFlowNode>) {
  const { node, selection, editable, select } = data;
  const rows = orderedTreeRows(node.rows ?? []);
  return (
    <article className="tree-node">
      <NodeResizer isVisible={editable && selected} minHeight={80} minWidth={240} />
      <header className="node-header">
        <span className="node-label">{node.label}</span>
        <span className="node-kind">tree</span>
      </header>
      <div className="tree-rows">
        {rows.map((row) => {
          const depth = treeRowDepth(node.rows ?? [], row);
          const isSelected = selection?.kind === 'tree-row'
            && selection.nodeId === node.id && selection.rowId === row.id;
          return (
            <button
              className={`tree-row ${rowTone(row)}${isSelected ? ' is-selected' : ''}${depth > 0 ? ' is-child' : ''}`}
              key={row.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                select({ kind: 'tree-row', nodeId: node.id, rowId: row.id });
              }}
              style={{ paddingLeft: 10 + depth * 20 }}
              type="button"
            >
              <span className="tree-row-text">
                {row.label ?? row.id}
                {row.status && <span className="tree-row-status">[{row.status}]</span>}
              </span>
              {row.badges.map((badge) => <span className="tree-row-badge" key={badge}>◆{badge}</span>)}
            </button>
          );
        })}
      </div>
    </article>
  );
}
