/**
 * The Command Center's causal field: chains of consequence on a dark landscape.
 *
 * This component owns only presentation state — tier, settling snapshot, lit chip,
 * drawer height, tether geometry. Object truth stays in the host contract, and the
 * resolving chain is held on screen just long enough to
 * play its release before the patch removes it from the feed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EdgeTypes, NodeTypes } from '@xyflow/react';
import './causal-field.css';
import type { AttentionAction, AttentionItem } from '../../../../attention/feed';
import { field } from '../../../../object-graph/graph';
import { WorldCanvas, type CanvasCameraRequest } from '../../../../components/canvas/WorldCanvas';
import { EmptyState } from '../../../../components/ui/ui';
import type { CommandCenterDesignProps } from '../../command-center-design';
import { buildChains } from './chains';
import { ChainEdge } from './ChainEdge';
import { ChainNode } from './ChainNode';
import { FieldScene } from './FieldScene';
import { layoutField } from './field-layout';
import { resolveFieldTier, type FieldTier } from './field-semantic-zoom';
import { fieldToFlow } from './field-to-flow';
import { InspectorDrawer } from './InspectorDrawer';

const fieldNodeTypes = { 'chain-chip': ChainNode } satisfies NodeTypes;
const fieldEdgeTypes = { causal: ChainEdge } satisfies EdgeTypes;
const VIEWPORT_KEY = 'area:command-center';
const SETTLE_MS = 950;

/** Rooms hero-framed this session, so re-entering never re-runs the arrival move. */
const heroFramed = new Set<string>();

type Tether = { x1: number; y1: number; x2: number; y2: number; elected: boolean };

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function CausalField({ data, commands }: CommandCenterDesignProps) {
  const { feed, elected, graph, selected } = data;
  const [tier, setTier] = useState<FieldTier>('working');
  const [litId, setLitId] = useState<string | null>(null);
  const [settlingChain, setSettlingChain] = useState<number | null>(null);
  const [drawerHeight, setDrawerHeight] = useState(320);
  const [cameraRequest, setCameraRequest] = useState<CanvasCameraRequest | null>(null);
  const [tether, setTether] = useState<Tether | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);

  const chains = useMemo(() => buildChains(feed, graph), [feed, graph]);
  const layout = useMemo(() => layoutField(chains), [chains]);

  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
  }, []);

  /**
   * One arrival frame per session — a confident crop on the monument's
   * neighbourhood (its whole chain plus the next two roots), not a timid fit of
   * the entire field. The rest is one pan away; the camera is yours after this.
   */
  useEffect(() => {
    if (heroFramed.has(VIEWPORT_KEY) || chains.length === 0) return;
    heroFramed.add(VIEWPORT_KEY);
    const live = chains.filter((chain) => !chain.settled);
    const monolith = live[0];
    const neighbourhood = monolith
      ? [monolith.root.id, ...monolith.links.map((link) => link.record.id), ...live.slice(1, 3).map((chain) => chain.root.id)]
      : chains.map((chain) => chain.root.id);
    setCameraRequest({
      key: `hero:${VIEWPORT_KEY}`,
      nodeIds: neighbourhood,
      viewportInsets: { top: '10%', right: '7%', bottom: '12%', left: '7%' },
      maxZoom: 1.02,
      duration: 720,
    });
  }, [chains]);

  const act = useCallback(
    (item: AttentionItem, kind: AttentionAction['kind'], answer?: string) => {
      if (item.reason === 'decision' && kind === 'respond' && !answer) {
        commands.select(item.subject.id);
        return;
      }
      const commit = () => {
        commands.act(item, kind, answer ? { response: answer } : undefined);
        setSettlingChain(null);
        setLitId(null);
        commands.select(null);
      };
      const chainIndex = chains.findIndex((chain) => chain.item.id === item.id);
      if (chainIndex < 0 || reducedMotion()) {
        commit();
        return;
      }
      setSettlingChain(chainIndex);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(commit, SETTLE_MS);
    },
    [chains, commands],
  );

  const focalChains = useMemo(() => {
    if (!selected) return new Set<number>();
    return new Set(layout.chainsOf.get(selected.id) ?? []);
  }, [layout, selected]);

  const flow = useMemo(
    () =>
      fieldToFlow(layout, {
        chains,
        tier,
        focalChains,
        settlingChain,
        litId,
        selectedId: selected?.id ?? null,
        onAct: act,
      }),
    [act, chains, focalChains, layout, litId, selected?.id, settlingChain, tier],
  );

  /** The chain the drawer narrates: the selected object's heaviest chain. */
  const drawerChain = useMemo(() => {
    if (!selected) return null;
    const index = (layout.chainsOf.get(selected.id) ?? [])[0];
    return index === undefined ? null : (chains[index] ?? null);
  }, [chains, layout, selected]);

  const drawerRows = useMemo(() => {
    if (!drawerChain || !selected) return [];
    const rows: { record: typeof drawerChain.root; verb: string | null }[] = [
      { record: drawerChain.root, verb: null },
      ...drawerChain.links.map((link) => ({ record: link.record, verb: link.verb })),
    ];
    return rows.filter((row) => row.record.id !== selected.id);
  }, [drawerChain, selected]);

  /**
   * The tether: measured chip → drawer header geometry, kept honest with a frame
   * loop while the drawer is open (pan, zoom and drag all move the endpoint).
   */
  useEffect(() => {
    if (!selected) {
      setTether(null);
      return;
    }
    let frame = 0;
    const electedSubject = elected?.subject.id === selected.id;
    const measure = () => {
      const container = containerRef.current;
      const chip = container?.querySelector(`.react-flow__node[data-id="${CSS.escape(selected.id)}"]`);
      const header = container?.querySelector('.inspector-drawer__header');
      if (container && chip && header) {
        const base = container.getBoundingClientRect();
        const chipRect = chip.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const next: Tether = {
          x1: chipRect.left + chipRect.width / 2 - base.left,
          y1: chipRect.bottom - base.top,
          x2: headerRect.left + 48 - base.left,
          y2: headerRect.top + 6 - base.top,
          elected: electedSubject,
        };
        setTether((previous) =>
          previous &&
          Math.abs(previous.x1 - next.x1) < 0.5 &&
          Math.abs(previous.y1 - next.y1) < 0.5 &&
          Math.abs(previous.y2 - next.y2) < 0.5
            ? previous
            : next,
        );
      }
      frame = window.requestAnimationFrame(measure);
    };
    frame = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frame);
  }, [elected?.subject.id, selected]);

  const liveAgents = graph.byKind('agent').filter((a) => field(a, 'status') === 'live').length;
  const runs = graph.byKind('agentRun').filter((r) => field(r, 'status') === 'running').length;
  const waiting = chains.filter((chain) => !chain.settled).length;

  const tetherPath = tether
    ? `M ${tether.x1} ${tether.y1} C ${tether.x1} ${tether.y1 + 48}, ${tether.x2} ${tether.y2 - 72}, ${tether.x2} ${tether.y2}`
    : '';

  const scene: ReactNode = <FieldScene layout={layout} tier={tier} />;

  if (feed.length === 0) {
    return (
      <div className="causal-field causal-field--empty">
        <EmptyState>Nothing is waiting on you.</EmptyState>
      </div>
    );
  }

  return (
    <div className="causal-field" ref={containerRef} data-focused={focalChains.size > 0}>
      <div className="causal-field__stage">
        <WorldCanvas
          viewportKey={VIEWPORT_KEY}
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={fieldNodeTypes}
          edgeTypes={fieldEdgeTypes}
          selectedId={selected?.id ?? null}
          onSelect={commands.select}
          onZoomChange={(zoom) => setTier((previous) => resolveFieldTier(zoom, previous))}
          cameraRequest={cameraRequest}
          canvasChildren={scene}
          showControls={false}
        />
        <div className="causal-field__vignette" aria-hidden="true" />

        <div className="causal-field__hud" aria-hidden="true">
          <span>Causal field</span>
          <strong>
            {waiting} waiting · {liveAgents} agents live · {runs} runs in flight
          </strong>
        </div>
        <div className="causal-field__tier" aria-hidden="true">
          <span>Scale</span>
          <i data-active={tier === 'far'}>Far</i>
          <i data-active={tier === 'working'}>Working</i>
          <i data-active={tier === 'near'}>Near</i>
        </div>
      </div>

      {selected && (
        <InspectorDrawer
          subject={selected}
          item={drawerChain && selected.id === drawerChain.root.id ? drawerChain.item : null}
          chain={drawerRows}
          litId={litId}
          onLight={setLitId}
          onAct={act}
          height={drawerHeight}
          onResize={setDrawerHeight}
          graph={graph}
          onSelect={commands.select}
          canOpen={commands.canOpen}
          onOpen={commands.open}
        />
      )}

      {tether && (
        <svg className="causal-field__tether" data-elected={tether.elected} aria-hidden="true">
          <path key={selected?.id} className="causal-field__tether-line" d={tetherPath} />
          {litId && (
            <circle key={litId} className="causal-field__tether-pulse" r="3">
              <animateMotion dur="0.6s" repeatCount="1" fill="freeze" path={tetherPath} keyPoints="1;0" keyTimes="0;1" />
            </circle>
          )}
        </svg>
      )}
    </div>
  );
}
