import { type EdgeTypes, type NodeTypes } from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import './messages-atlas.css';
import { WorldCanvas } from '../../../../components/canvas/WorldCanvas';
import type { WorldCameraCommand, WorldViewport } from '../../../../components/canvas/world-camera';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { field, type ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignProps } from '../../messages-design';
import { AtlasLandmarkNode } from './AtlasLandmarkNode';
import { AtlasRouteEdge } from './AtlasRouteEdge';
import { AtlasScreenLayer } from './AtlasScreenLayer';
import { AtlasTerrainScene } from './AtlasTerrainScene';
import { buildAtlasGeometry } from './atlas-geometry';
import { projectAtlas, type AtlasEdge, type AtlasNode } from './atlas-projection';
import { resolveZoomTier, type AtlasZoomTier } from './atlas-semantic-zoom';

const nodeTypes = { atlasLandmark: AtlasLandmarkNode } satisfies NodeTypes;
const edgeTypes = { atlasRoute: AtlasRouteEdge } satisfies EdgeTypes;
const initialViewport: WorldViewport = { x: 0, y: 0, zoom: 1 };
const framedAtlasRooms = new Set<string>();

function roleOf(graph: ObjectGraph, agent: ObjectRecord): string {
  const seat = graph.relatedBy(agent.id, 'occupies')[0];
  return seat ? graph.relatedBy(seat.id, 'requests')[0]?.title ?? 'Unseated' : 'Unseated';
}

function unreadThreadIds(graph: ObjectGraph): ReadonlySet<string> {
  return new Set(
    graph
      .byKind('notification')
      .filter((notification) => field(notification, 'status') === 'unread')
      .map((notification) => (
        notification.fields.subjectRef as { id?: string } | undefined
      )?.id)
      .filter((id): id is string => typeof id === 'string'),
  );
}

/** Messages rendered as a navigable transcript territory. */
export function MessagesAtlas({ data, commands }: MessagesDesignProps) {
  const { graph, threads, liveAgents, selected, initialThreadId } = data;
  const containerRef = useRef<HTMLDivElement>(null);
  const previousViewportRef = useRef<WorldViewport | null>(null);
  const viewportRef = useRef<WorldViewport>(initialViewport);
  const traversalTimersRef = useRef<number[]>([]);
  const cameraSequence = useRef(0);
  const [tier, setTier] = useState<AtlasZoomTier>('working');
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(initialThreadId ?? null);
  const [traversing, setTraversing] = useState(false);
  const [revealCount, setRevealCount] = useState(99);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [trail, setTrail] = useState<ObjectRecord[]>(selected ? [selected] : []);
  const [cameraCommand, setCameraCommand] = useState<WorldCameraCommand | null>(null);
  const viewportKey = `messages:transcript-atlas:${initialThreadId ?? 'room'}`;
  const positions = useRef(new Map<string, { x: number; y: number }>()).current;
  const unreadIds = useMemo(() => unreadThreadIds(graph), [graph]);
  const geometry = useMemo(
    () => buildAtlasGeometry(graph, threads, unreadIds),
    [graph, threads, unreadIds],
  );
  const projection = useMemo(
    () => projectAtlas(geometry, {
      tier,
      focusedThreadId,
      selectedId: selected?.id ?? null,
      traversing,
      revealCount,
      positions,
    }),
    [focusedThreadId, geometry, positions, revealCount, selected?.id, tier, traversing],
  );

  const nextCameraKey = (label: string): string => {
    cameraSequence.current += 1;
    return `${label}:${cameraSequence.current}`;
  };

  const clearTraversalTimers = useCallback(() => {
    traversalTimersRef.current.forEach(window.clearTimeout);
    traversalTimersRef.current = [];
  }, []);

  const traverse = useCallback((threadId: string) => {
    clearTraversalTimers();
    if (focusedThreadId !== threadId) previousViewportRef.current = viewportRef.current;
    setFocusedThreadId(threadId);
    setTraversing(true);
    setRevealCount(0);
    commands.select(graph.get(threadId) ?? null);

    const ids = geometry.nodeIdsByThread.get(threadId) ?? [threadId];
    setCameraCommand({
      type: 'frame-nodes',
      key: nextCameraKey(`atlas-traverse:${threadId}`),
      nodeIds: ids,
      padding: { top: '16%', right: '34%', bottom: '18%', left: '12%' },
      minZoom: 0.42,
      maxZoom: 1.08,
      duration: 540,
    });

    const messageCount = graph.relatedOfKind(threadId, 'contains', 'message').length;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || messageCount === 0) {
      setRevealCount(99);
      setTraversing(false);
      return;
    }

    const interval = Math.min(70, Math.floor(700 / messageCount));
    for (let index = 1; index <= messageCount; index += 1) {
      traversalTimersRef.current.push(
        window.setTimeout(() => setRevealCount(index), 110 + index * interval),
      );
    }
    traversalTimersRef.current.push(
      window.setTimeout(
        () => setTraversing(false),
        Math.min(880, 150 + messageCount * interval),
      ),
    );
  }, [clearTraversalTimers, commands, focusedThreadId, geometry.nodeIdsByThread, graph]);

  useEffect(() => {
    if (framedAtlasRooms.has(viewportKey) || projection.nodes.length === 0) return;
    framedAtlasRooms.add(viewportKey);
    const timer = window.setTimeout(() => {
      if (initialThreadId) {
        traverse(initialThreadId);
        return;
      }
      setCameraCommand({
        type: 'frame-nodes',
        key: nextCameraKey('atlas-overview'),
        nodeIds: geometry.overviewNodeIds,
        padding: 0.17,
        minZoom: 0.25,
        maxZoom: 0.7,
        duration: 720,
      });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [geometry.overviewNodeIds, initialThreadId, projection.nodes.length, traverse, viewportKey]);

  useEffect(() => () => clearTraversalTimers(), [clearTraversalTimers]);

  useEffect(() => {
    if (!pendingThreadId || !geometry.nodeIdsByThread.has(pendingThreadId)) return;
    setPendingThreadId(null);
    traverse(pendingThreadId);
  }, [geometry.nodeIdsByThread, pendingThreadId, traverse]);

  useEffect(() => {
    if (!selected) setTrail([]);
    else setTrail((current) => (
      current.at(-1)?.id === selected.id ? current : [...current, selected]
    ));
  }, [selected]);

  const returnToAtlas = () => {
    clearTraversalTimers();
    setTraversing(false);
    setRevealCount(99);
    setFocusedThreadId(null);
    if (previousViewportRef.current) {
      setCameraCommand({
        type: 'set-viewport',
        key: nextCameraKey('atlas-return'),
        viewport: previousViewportRef.current,
        duration: 480,
      });
    }
  };

  const showOverview = () => {
    setFocusedThreadId(null);
    setCameraCommand({
      type: 'frame-nodes',
      key: nextCameraKey('atlas-overview'),
      nodeIds: geometry.overviewNodeIds,
      padding: 0.17,
      maxZoom: 0.7,
      duration: 480,
    });
  };

  const focusLandmark = (id: string) => {
    setCameraCommand({
      type: 'focus-node',
      key: nextCameraKey(`atlas-landmark:${id}`),
      nodeId: id,
      padding: 0.48,
      zoom: 1.18,
      duration: 420,
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!focusedThreadId || !draft.trim()) return;
    commands.send(focusedThreadId, draft.trim());
    setDraft('');
  };

  return (
    <div
      className="messages-atlas"
      ref={containerRef}
      data-tier={tier}
      data-focused={focusedThreadId !== null}
    >
      <WorldCanvas<AtlasNode, AtlasEdge>
        viewportKey={viewportKey}
        nodes={projection.nodes}
        edges={projection.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectedId={selected?.id ?? null}
        onSelect={(id) => commands.select(id ? graph.get(id) ?? null : null)}
        onViewportChange={(viewport) => {
          viewportRef.current = viewport;
          setTier((current) => resolveZoomTier(viewport.zoom, current));
        }}
        cameraCommand={cameraCommand}
        interaction={{ minZoom: 0.2, maxZoom: 1.8 }}
        canvasChildren={<AtlasTerrainScene fields={geometry.missionFields} />}
        surfaceClassName="messages-atlas__flow"
        screenChildren={selected ? (
          <AtlasScreenLayer
            containerRef={containerRef}
            graph={graph}
            selected={selected}
            trail={trail}
            commands={commands}
            onTraverse={traverse}
            onFocus={focusLandmark}
          />
        ) : null}
      />

      <div className="messages-atlas__chrome">
        <button
          type="button"
          className="messages-atlas__new"
          onClick={() => {
            setPickerOpen((value) => !value);
            commands.select(null);
          }}
        >
          <span>+</span> New conversation
        </button>
        <button
          type="button"
          className="messages-atlas__overview"
          onClick={focusedThreadId ? returnToAtlas : showOverview}
        >
          {focusedThreadId ? '← Return to atlas' : 'Overview'}
        </button>
      </div>

      {pickerOpen && (
        <aside className="messages-atlas__picker" aria-label="Start an Agent conversation">
          <header>
            <span>Plot a new route</span>
            <button type="button" onClick={() => setPickerOpen(false)}>×</button>
          </header>
          <p>Choose a live Agent outpost.</p>
          {liveAgents.map((agent) => (
            <button
              type="button"
              className="messages-atlas__agent-choice"
              key={agent.id}
              onClick={() => {
                const id = commands.startConversation(agent);
                setPickerOpen(false);
                setPendingThreadId(id);
              }}
            >
              <span>{agent.title.slice(0, 2).toUpperCase()}</span>
              <strong>{agent.title}<small>{roleOf(graph, agent)}</small></strong>
              <em>{field(agent, 'status')}</em>
            </button>
          ))}
        </aside>
      )}

      {focusedThreadId && (
        <form className="messages-atlas__composer" onSubmit={submit}>
          <span className="messages-atlas__composer-bearing">On route</span>
          <textarea
            value={draft}
            rows={1}
            placeholder="Place a message on this ridge…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) submit(event);
            }}
          />
          <button type="submit" disabled={!draft.trim()}>Send <span>↗</span></button>
        </form>
      )}
    </div>
  );
}
