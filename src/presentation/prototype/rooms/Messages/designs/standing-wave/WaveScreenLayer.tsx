/**
 * Everything that must hold still while time scrolls underneath.
 *
 * The lane legend, the live roster, the composer and the Trace Reader all live in the
 * canvas's screen plane rather than in world space, so panning through the clock never
 * takes the controls with it. The legend is the one exception that still tracks the
 * canvas vertically, because a channel label has to stay on its channel.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanvasRuntime } from '../../../../components/canvas/canvas-runtime-context';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { StandingWaveModel, WaveAgent, WaveTrace } from './standing-wave-model';
import type { WaveLane } from './standing-wave-projection';
import { TraceReaderInspector } from './TraceReaderInspector';
import { WaveComposer } from './WaveComposer';
import { WaveLaneLegend } from './WaveLaneLegend';
import { WaveNowRail } from './WaveNowRail';
import { WaveSelectionTether } from './WaveSelectionTether';

type Bounds = { left: number; top: number; width: number; height: number };

function useHostSize(hostRef: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);
  return size;
}

/** Measures the panel after it mounts, so the tether can reach it on the first paint. */
function usePanelBounds(
  hostRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
): Bounds | null {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const panel = panelRef.current;
    if (!host || !panel || !isOpen) {
      setBounds(null);
      return;
    }
    const measure = () => {
      const hostBox = host.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      setBounds({
        left: panelBox.left - hostBox.left,
        top: panelBox.top - hostBox.top,
        width: panelBox.width,
        height: panelBox.height,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    return () => observer.disconnect();
  }, [hostRef, isOpen, panelRef]);

  return bounds;
}

/** Places the inspector, its tether, the legend, the roster and the composer. */
export function WaveScreenLayer({
  hostRef,
  graph,
  model,
  lanes,
  activeTrace,
  selected,
  selectedNodeId,
  commands,
  onChooseThread,
  onChooseAgent,
  onCloseInspector,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  graph: ObjectGraph;
  model: StandingWaveModel;
  lanes: readonly WaveLane[];
  activeTrace: WaveTrace | null;
  selected: ObjectRecord | null;
  selectedNodeId: string | null;
  commands: MessagesDesignCommands;
  onChooseThread: (threadId: string) => void;
  onChooseAgent: (agent: WaveAgent) => void;
  onCloseInspector: () => void;
}) {
  const runtime = useCanvasRuntime();
  const panelRef = useRef<HTMLElement>(null);
  const size = useHostSize(hostRef);

  const hostBox = hostRef.current?.getBoundingClientRect();
  const nodeBox = selectedNodeId ? runtime.getNodeScreenBounds(selectedNodeId) : null;
  const tetherSource = hostBox && nodeBox
    ? { x: nodeBox.centerX - hostBox.left, y: nodeBox.centerY - hostBox.top }
    : null;
  const peakIsUnresolved = model.peakThreadId !== null;
  const panelBounds = usePanelBounds(hostRef, panelRef, Boolean(selected && activeTrace));

  return (
    <div className="wave-screen-layer">
      <WaveLaneLegend
        lanes={lanes}
        viewport={runtime.viewport}
        activeThreadId={activeTrace?.record.id ?? ''}
        onChooseThread={onChooseThread}
      />
      <WaveNowRail
        agents={model.agents}
        activeThreadId={activeTrace?.record.id ?? ''}
        onChooseAgent={onChooseAgent}
      />
      {activeTrace && (
        <WaveComposer
          agentName={activeTrace.agent?.title ?? 'this conversation'}
          peakIsUnresolved={peakIsUnresolved}
          onSend={(body) => commands.send(activeTrace.record.id, body)}
        />
      )}
      {selected && activeTrace && (
        <>
          <WaveSelectionTether
            source={tetherSource}
            panel={panelBounds}
            width={size.width}
            height={size.height}
          />
          <TraceReaderInspector
            selected={selected}
            trace={activeTrace}
            graph={graph}
            commands={commands}
            panelRef={panelRef}
            onClose={onCloseInspector}
            onInspect={commands.select}
          />
        </>
      )}
    </div>
  );
}
