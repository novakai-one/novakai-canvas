import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CanvasEngine } from '../application/canvas-engine';
import { applyLayoutProposal, previewLayout } from '../domain/layout-proposal';
import type { ArchitectureDocument, CanvasPreferences, LayoutProposal, LayoutTarget } from '../domain/model';
import type { ArchitectureMap } from '../domain/maps';

export interface LayoutPreviewActions {
  apply(): void;
  cancel(): void;
  preview(): void;
  undo(): void;
  proposal: LayoutProposal | null;
  selectedNodeCount: number;
}

function targetFor(
  document: ArchitectureDocument,
  activeMap: ArchitectureMap,
  selectedNodeIds: string[],
): LayoutTarget {
  const selectedId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : undefined;
  if (selectedId && document.nodes[selectedId]?.kind === 'scope') {
    return { kind: 'scope', scopeId: selectedId };
  }
  return selectedNodeIds.length > 0
    ? { kind: 'nodes', nodeIds: selectedNodeIds }
    : { kind: 'scope', scopeId: activeMap.rootNodeId };
}

interface LayoutPreviewInput {
  document: ArchitectureDocument;
  preferences: CanvasPreferences;
  engine: CanvasEngine;
  maps: ArchitectureMap[];
  activeMapId?: string;
  editable: boolean;
}

/** Owns transient layout proposals and exposes small intentions to the renderer. */
export function useLayoutPreview(input: LayoutPreviewInput) {
  const [fitRevision, setFitRevision] = useState(0);
  const [proposal, setProposal] = useState<LayoutProposal | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const currentProposal = proposal?.baseRevision === input.document.revision ? proposal : null;
  useEffect(() => {
    if (proposal && !currentProposal) setProposal(null);
  }, [currentProposal, proposal]);
  const displayDocument = useMemo(
    () => currentProposal ? applyLayoutProposal(input.document, currentProposal) : input.document,
    [currentProposal, input.document],
  );
  const onSelectionChange = useCallback(({ nodes }: { nodes: Array<{ id: string }> }) => {
    const nextIds = nodes.map((node) => node.id).sort();
    setSelectedNodeIds((currentIds) =>
      currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])
        ? currentIds
        : nextIds);
  }, []);
  const refit = (): void => setFitRevision((revision) => revision + 1);
  const layout: LayoutPreviewActions = {
    proposal: currentProposal,
    selectedNodeCount: selectedNodeIds.length,
    cancel: () => setProposal(null),
    preview: () => {
      const activeMap = input.maps.find((map) => map.id === input.activeMapId);
      if (!activeMap) return;
      setProposal(previewLayout(input.document, {
        target: targetFor(input.document, activeMap, selectedNodeIds),
        groupPadding: input.preferences.canvas.groupPadding,
      }));
    },
    apply: () => {
      if (!currentProposal) return;
      input.engine.execute({ kind: 'layout.apply', proposal: currentProposal });
      setProposal(null);
      refit();
    },
    undo: () => {
      if (!input.engine.undo()) return;
      setProposal(null);
      refit();
    },
  };
  return {
    currentProposal,
    displayDocument,
    fitRevision,
    interactionEnabled: input.editable && !currentProposal,
    layout,
    onSelectionChange,
  };
}
