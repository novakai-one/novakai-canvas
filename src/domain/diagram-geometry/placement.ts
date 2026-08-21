import type {
  ArchitectureDocument, NodePlacement, Size,
} from '../model.ts';
import { layoutContainer } from './container.ts';
import { LayoutState } from './state.ts';

const DEFAULT_GROUP_PADDING = 40;
const SCOPE_GAP = 80;
const NEW_SCOPE_X = 40;

function explicitDescendantRoots(state: LayoutState, scopeId: string): string[] {
  const arrangements = state.layout.arrangementByContainerId ?? {};
  return Object.keys(arrangements)
    .filter((containerId) => {
      let cursor = state.document.nodes[containerId]?.parentId;
      while (cursor && cursor !== scopeId) cursor = state.document.nodes[cursor]?.parentId;
      return cursor === scopeId;
    })
    .filter((containerId) => {
      let cursor = state.document.nodes[containerId]?.parentId;
      while (cursor && cursor !== scopeId) {
        if (arrangements[cursor]) return false;
        cursor = state.document.nodes[cursor]?.parentId;
      }
      return true;
    });
}

function growAncestorBounds(state: LayoutState, childId: string): void {
  let currentId = childId;
  let parentId = state.document.nodes[currentId]?.parentId;
  while (parentId) {
    const child = state.document.nodes[currentId];
    const parent = state.document.nodes[parentId];
    state.document.nodes[parentId] = {
      ...parent,
      size: {
        width: Math.max(parent.size.width, child.position.x + child.size.width + state.groupPadding),
        height: Math.max(parent.size.height, child.position.y + child.size.height + state.groupPadding),
      },
    };
    currentId = parentId;
    parentId = state.document.nodes[currentId]?.parentId;
  }
}

function placeNewScopes(state: LayoutState, scopeIds: readonly string[]): void {
  for (const scopeId of scopeIds) {
    let bottom = 0;
    for (const node of Object.values(state.document.nodes)) {
      if (node.parentId || node.id === scopeId || scopeIds.includes(node.id)) continue;
      bottom = Math.max(bottom, node.position.y + node.size.height);
    }
    for (const other of scopeIds) {
      if (other === scopeId) break;
      const previous = state.document.nodes[other];
      bottom = Math.max(bottom, previous.position.y + previous.size.height);
    }
    state.document.nodes[scopeId] = {
      ...state.document.nodes[scopeId],
      position: { x: NEW_SCOPE_X, y: bottom + SCOPE_GAP },
    };
  }
}

function placementsFromState(state: LayoutState): Record<string, NodePlacement> {
  return Object.fromEntries(Object.entries(state.document.nodes).map(([nodeId, node]) => [nodeId, {
    nodeId,
    position: node.position,
    size: node.size,
    pinned: state.layout.placements[nodeId]?.pinned ?? false,
  }]));
}

function needsInitialLayout(state: LayoutState, scopeId: string, isNew: boolean): boolean {
  return isNew || state.orderedDirectChildIds(scopeId)
    .some((id) => state.document.nodes[id].size.width === 1
      && state.document.nodes[id].size.height === 1);
}

function applyContainerSize(state: LayoutState, containerId: string): Size {
  const size = layoutContainer(state, containerId);
  state.document.nodes[containerId] = { ...state.document.nodes[containerId], size };
  return size;
}

/** Re-layouts named scopes in one saved layout without changing semantic nodes. */
export function layoutScopes(
  input: ArchitectureDocument,
  scopeIds: string[],
  layoutId?: string,
  requestedGroupPadding = DEFAULT_GROUP_PADDING,
): ArchitectureDocument {
  const state = LayoutState.create(input, layoutId, requestedGroupPadding);
  const sortedScopeIds = [...scopeIds].sort();
  const newScopeIds: string[] = [];

  for (const scopeId of sortedScopeIds) {
    const scope = state.document.nodes[scopeId];
    if (!scope || scope.kind !== 'scope') continue;
    const isNew = scope.size.width === 1 && scope.size.height === 1;
    if (isNew) newScopeIds.push(scopeId);
    const arrangedRoots = explicitDescendantRoots(state, scopeId);

    if (state.arrangementFor(scopeId)
      || arrangedRoots.length === 0
      || needsInitialLayout(state, scopeId, isNew)) {
      applyContainerSize(state, scopeId);
      continue;
    }

    for (const containerId of arrangedRoots) {
      applyContainerSize(state, containerId);
      growAncestorBounds(state, containerId);
    }
  }

  placeNewScopes(state, newScopeIds);
  return {
    ...input,
    layouts: {
      ...input.layouts,
      [state.layout.id]: {
        ...state.layout,
        strategy: 'hierarchy',
        placements: placementsFromState(state),
      },
    },
  };
}
