import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './causal-loom.css';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand, WorldViewport } from '../../../../components/canvas/world-camera';
import { EmptyState } from '../../../../components/ui/ui';
import { field } from '../../../../object-graph/graph';
import type {
  CommandActionInput,
  CommandCenterDesignProps,
  CommandOutcome,
} from '../../command-center-design';
import {
  buildInspectorContext,
  projectCausalLoom,
  type LoomKnotPlacement,
  type LoomZoomTier,
} from './causal-loom-model';
import type { LoomKnotFlowNode } from './LoomKnotNode';
import { LoomScene } from './LoomScene';
import type { LoomThreadFlowEdge } from './LoomThreadEdge';
import type { MissionSpindleFlowNode } from './MissionSpindleNode';
import { SelectionTether } from './SelectionTether';
import { WalkInInspector } from './WalkInInspector';
import {
  initialLoomViewport,
  isLoomNodeSelected,
  LOOM_VIEWPORT_KEY,
  loomEdgeTypes,
  loomNodeTypes,
  resolveLoomSelectionId,
  resolveLoomTier,
  setsIntersect,
  type LoomNode,
} from './loom-canvas-config';

const EMPTY_CONTEXT_IDS: ReadonlySet<string> = new Set();

/** Command Center attention rendered as a spatial causal loom. */
export function CausalLoom({ data, commands }: CommandCenterDesignProps) {
  const { graph, feed, elected, selected } = data;
  const latestElectionRef = useRef(elected?.id ?? null);
  const selectedItemSnapshotRef = useRef<(typeof feed)[number] | null>(null);
  const timersRef = useRef<number[]>([]);
  const viewportRef = useRef<WorldViewport>(initialLoomViewport);
  const cameraSequence = useRef(0);
  const [tier, setTier] = useState<LoomZoomTier>('working');
  const [inspectorReady, setInspectorReady] = useState(false);
  const [selectionOrigin, setSelectionOrigin] = useState<'knot' | 'spindle' | null>(null);
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null);
  const [releaseGhost, setReleaseGhost] = useState<LoomKnotPlacement | null>(null);
  const [visibleElectionId, setVisibleElectionId] = useState(elected?.id ?? null);
  const [cameraCommand, setCameraCommand] = useState<WorldCameraCommand | null>(null);

  latestElectionRef.current = elected?.id ?? null;

  useEffect(() => () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!releaseGhost) setVisibleElectionId(elected?.id ?? null);
  }, [elected?.id, releaseGhost]);

  const projection = useMemo(
    () => projectCausalLoom(
      graph,
      feed,
      visibleElectionId,
      selectionOrigin === 'spindle' ? null : (selected?.id ?? null),
    ),
    [feed, graph, selected?.id, selectionOrigin, visibleElectionId],
  );

  const currentItem = selected && selectionOrigin !== 'spindle'
    ? feed.find((item) => item.subject.id === selected.id) ?? null
    : null;
  if (currentItem) selectedItemSnapshotRef.current = currentItem;
  const inspectorItem = selectionOrigin === 'spindle'
    ? null
    : currentItem
      ?? (selectedItemSnapshotRef.current?.subject.id === selected?.id
        ? selectedItemSnapshotRef.current
        : null);
  const context = useMemo(
    () => selected ? buildInspectorContext(graph, selected) : null,
    [graph, selected],
  );

  const selectedKnot = projection.knots.find((knot) => knot.item.subject.id === selected?.id);
  const selectedSpindleId = selected?.kind === 'mission'
    ? `spindle:${selected.id}`
    : selectedKnot?.spindleId ?? null;
  const selectedContextIds = selectedKnot?.contextIds ?? EMPTY_CONTEXT_IDS;
  const selectedSpindleKnotIds = useMemo(
    () => new Set(
      projection.knots
        .filter((knot) => knot.spindleId === selectedSpindleId)
        .map((knot) => knot.id),
    ),
    [projection.knots, selectedSpindleId],
  );

  const selectKnot = useCallback((id: string) => {
    setSelectionOrigin('knot');
    commands.select(id);
  }, [commands]);

  const selectSpindle = useCallback((id: string) => {
    setSelectionOrigin('spindle');
    commands.select(id);
  }, [commands]);

  const nodes = useMemo<LoomNode[]>(() => {
    const spindleNodes: MissionSpindleFlowNode[] = projection.spindles.map((spindle) => ({
      id: spindle.id,
      type: 'mission-spindle',
      position: spindle.position,
      draggable: false,
      selectable: Boolean(spindle.mission),
      zIndex: 1,
      style: { width: 1, height: 1 },
      data: {
        mission: spindle.mission,
        title: spindle.title,
        attentionCount: spindle.attentionCount,
        containsElected: spindle.containsElected,
        tier,
        dimmed: Boolean(selected && selectedSpindleId !== spindle.id),
        onSelect: selectSpindle,
      },
    }));

    const knotNodes: LoomKnotFlowNode[] = projection.knots.map((knot) => {
      const relatedToSelection = selectionOrigin === 'spindle'
        ? knot.spindleId === selectedSpindleId
        : !selectedKnot || knot.selected || setsIntersect(knot.contextIds, selectedContextIds);
      return {
        id: knot.id,
        type: 'loom-knot',
        position: { x: knot.position.x - 105, y: knot.position.y - 42 },
        draggable: true,
        selectable: true,
        zIndex: knot.selected ? 9 : knot.elected ? 7 : 4,
        style: { width: 210, height: 84 },
        data: {
          item: knot.item,
          tier: knot.selected && tier === 'overview' ? 'working' : tier,
          elected: knot.item.id === visibleElectionId,
          selected: knot.selected,
          dimmed: Boolean(selected && !relatedToSelection),
          releasing: false,
          onSelect: selectKnot,
        },
      };
    });

    if (releaseGhost && !knotNodes.some((node) => node.id === releaseGhost.id)) {
      knotNodes.push({
        id: releaseGhost.id,
        type: 'loom-knot',
        position: { x: releaseGhost.position.x - 105, y: releaseGhost.position.y - 42 },
        draggable: false,
        selectable: true,
        zIndex: 10,
        style: { width: 210, height: 84 },
        data: {
          item: releaseGhost.item,
          tier: releaseGhost.selected && tier === 'overview' ? 'working' : tier,
          elected: releaseGhost.item.id === visibleElectionId,
          selected: releaseGhost.item.subject.id === selected?.id,
          dimmed: false,
          releasing: true,
          onSelect: selectKnot,
        },
      });
    }

    return [...spindleNodes, ...knotNodes];
  }, [
    projection,
    releaseGhost,
    selectKnot,
    selectSpindle,
    selected,
    selectedContextIds,
    selectedKnot,
    selectedSpindleId,
    selectionOrigin,
    tier,
    visibleElectionId,
  ]);

  const edges = useMemo<LoomThreadFlowEdge[]>(() => {
    const result = projection.connections.map<LoomThreadFlowEdge>((connection) => ({
      id: connection.id,
      type: 'loom-thread',
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.kind === 'warp' ? 'field' : 'out',
      targetHandle: 'in',
      focusable: false,
      selectable: false,
      zIndex: 0,
      data: {
        kind: connection.kind,
        selected: connection.selected,
        elected: connection.elected,
        dimmed: Boolean(selected && !connection.selected && !(
          selectionOrigin === 'spindle'
          && (connection.source === selectedSpindleId || selectedSpindleKnotIds.has(connection.source))
          && (connection.target === selectedSpindleId || selectedSpindleKnotIds.has(connection.target))
        )),
      },
    }));

    if (releaseGhost && !projection.knots.some((knot) => knot.id === releaseGhost.id)) {
      result.push({
        id: `release:${releaseGhost.spindleId}:${releaseGhost.id}`,
        type: 'loom-thread',
        source: releaseGhost.spindleId,
        target: releaseGhost.id,
        sourceHandle: 'field',
        targetHandle: 'in',
        focusable: false,
        selectable: false,
        zIndex: 0,
        data: {
          kind: 'warp',
          selected: true,
          elected: releaseGhost.item.id === visibleElectionId,
          dimmed: false,
          releasing: true,
        },
      });
    }
    return result;
  }, [
    projection,
    releaseGhost,
    selected,
    selectedSpindleId,
    selectedSpindleKnotIds,
    selectionOrigin,
    visibleElectionId,
  ]);

  const selectedNodeId = (
    selectionOrigin === 'spindle' && selected?.kind === 'mission'
      ? `spindle:${selected.id}`
      : null
  ) ?? selectedKnot?.id
    ?? (releaseGhost && releaseGhost.item.subject.id === selected?.id ? releaseGhost.id : null);

  const focusNode = useCallback((nodeId: string | null, duration = 520) => {
    if (!nodeId) return;
    cameraSequence.current += 1;
    setCameraCommand({
      type: 'focus-node-at-anchor',
      key: `loom-focus:${nodeId}:${cameraSequence.current}`,
      nodeId,
      anchor: { horizontalRatio: 0.32, verticalRatio: 0.48 },
      zoom: Math.max(0.72, Math.min(viewportRef.current.zoom, 1.08)),
      duration,
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      setInspectorReady(false);
      setSelectionOrigin(null);
      return;
    }
    if (!selectedNodeId) {
      setInspectorReady(true);
      return;
    }
    setInspectorReady(false);
    focusNode(selectedNodeId);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setInspectorReady(true), reduceMotion ? 0 : 150);
    return () => window.clearTimeout(timer);
  }, [focusNode, selected, selectedNodeId]);

  useEffect(() => setOutcome(null), [selected?.id]);

  const performAction = useCallback((
    kind: Parameters<CommandCenterDesignProps['commands']['act']>[1],
    input: CommandActionInput = {},
  ): CommandOutcome => {
    if (!inspectorItem) {
      return { state: 'cancelled', message: 'The attention object is no longer available.' };
    }
    const ghost = projection.knots.find((knot) => knot.item.id === inspectorItem.id) ?? null;
    const result = commands.act(inspectorItem, kind, input);
    setOutcome(result);
    if (result.state !== 'applied' || !ghost) return result;

    setReleaseGhost(ghost);
    const wasElected = ghost.item.id === visibleElectionId;
    const releaseTimer = window.setTimeout(() => {
      setReleaseGhost(null);
      if (!wasElected) return;
      setVisibleElectionId(null);
      const electionTimer = window.setTimeout(
        () => setVisibleElectionId(latestElectionRef.current),
        180,
      );
      timersRef.current.push(electionTimer);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
    timersRef.current.push(releaseTimer);
    return result;
  }, [commands, inspectorItem, projection.knots, visibleElectionId]);

  const selectFromCanvas = useCallback((id: string | null) => {
    if (id === null) setSelectionOrigin(null);
    commands.select(id);
  }, [commands]);

  const changeZoom = (difference: number) => {
    cameraSequence.current += 1;
    setCameraCommand({
      type: 'set-zoom',
      key: `loom-zoom:${cameraSequence.current}`,
      zoom: Math.max(0.28, Math.min(1.65, viewportRef.current.zoom + difference)),
      duration: 180,
    });
  };

  if (feed.length === 0) {
    return <div className="causal-loom causal-loom--empty"><EmptyState>Nothing is waiting on you.</EmptyState></div>;
  }

  const liveAgents = graph.byKind('agent').filter((record) => field(record, 'status') === 'live').length;
  const liveRuns = graph.byKind('agentRun').filter((record) => field(record, 'status') === 'running').length;

  return (
    <div className="causal-loom" data-inspecting={Boolean(selected)} data-tier={tier}>
      <LoomScene
        waiting={feed.length}
        missions={projection.spindles.filter((spindle) => spindle.mission).length}
        agents={liveAgents}
        runs={liveRuns}
        tier={tier}
      />
      <WorldCanvas<LoomNode, LoomThreadFlowEdge>
        viewportKey={LOOM_VIEWPORT_KEY}
        nodes={nodes}
        edges={edges}
        nodeTypes={loomNodeTypes}
        edgeTypes={loomEdgeTypes}
        selectedId={selected?.id ?? null}
        onSelect={selectFromCanvas}
        resolveSelectionId={resolveLoomSelectionId}
        isNodeSelected={isLoomNodeSelected}
        onViewportChange={(viewport) => {
          viewportRef.current = viewport;
          setTier((current) => resolveLoomTier(current, viewport.zoom));
        }}
        cameraCommand={cameraCommand}
        interaction={{ minZoom: 0.28, maxZoom: 1.65 }}
        initialViewport={initialLoomViewport}
        fitViewOnMount={false}
        showControls={false}
        surfaceClassName="causal-loom__flow"
        screenChildren={(
          <SelectionTether
            nodeId={selectedNodeId}
            elected={inspectorItem?.id === visibleElectionId}
          />
        )}
      />

      <div className="causal-loom__controls" aria-label="Loom controls">
        <button type="button" onClick={() => changeZoom(-0.2)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => changeZoom(0.2)} aria-label="Zoom in">+</button>
        <button
          type="button"
          onClick={() => focusNode(selectedNodeId ?? projection.spindles[0]?.id ?? null, 360)}
        >
          Focus
        </button>
      </div>

      <WalkInInspector
        graph={graph}
        selected={selected}
        item={inspectorItem}
        context={context}
        outcome={outcome}
        ready={inspectorReady}
        onFocus={() => focusNode(selectedNodeId, 360)}
        onClose={() => selectFromCanvas(null)}
        onAction={performAction}
        canOpen={commands.canOpen}
        onOpen={commands.open}
      />
    </div>
  );
}
