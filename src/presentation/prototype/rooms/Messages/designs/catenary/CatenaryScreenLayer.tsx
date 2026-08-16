import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanvasRuntime } from '../../../../components/canvas/canvas-runtime-context';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import type { CableLoad } from './catenary-model';
import { LoadInspector } from './LoadInspector';

type Point = { readonly x: number; readonly y: number };
type Bounds = { left: number; top: number; width: number; height: number };

const TETHER_EDGE_INSET = 40;

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

function useInspectorBounds(
  hostRef: RefObject<HTMLElement | null>,
  inspectorRef: RefObject<HTMLElement | null>,
  viewport: object,
): Bounds | null {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const inspector = inspectorRef.current;
    if (!host || !inspector) return;

    const measure = () => {
      const hostBox = host.getBoundingClientRect();
      const inspectorBox = inspector.getBoundingClientRect();
      setBounds({
        left: inspectorBox.left - hostBox.left,
        top: inspectorBox.top - hostBox.top,
        width: inspectorBox.width,
        height: inspectorBox.height,
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(inspector);
    measure();
    return () => observer.disconnect();
  }, [hostRef, inspectorRef, viewport]);

  return bounds;
}

/** The one line allowed on screen while something is selected: bead to panel. */
function SelectionTether({
  source,
  inspector,
  width,
  height,
}: {
  source: Point | null;
  inspector: Bounds | null;
  width: number;
  height: number;
}) {
  if (!source || !inspector) return null;

  const targetX = inspector.left;
  const targetY = Math.max(
    inspector.top + TETHER_EDGE_INSET,
    Math.min(source.y, inspector.top + inspector.height - TETHER_EDGE_INSET),
  );
  const bend = Math.max(28, Math.min(140, (targetX - source.x) * 0.42));
  const path = `M ${source.x} ${source.y} C ${source.x + bend} ${source.y}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`;

  return (
    <svg
      className="catenary-tether"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
      <circle cx={source.x} cy={source.y} r="3.5" />
    </svg>
  );
}

/** Places the inspector and its tether in the screen plane, above the moving world. */
export function CatenaryScreenLayer({
  hostRef,
  graph,
  selected,
  sourceNodeId,
  load,
  commands,
  onClose,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  graph: ObjectGraph;
  selected: ObjectRecord;
  sourceNodeId: string | null;
  load: CableLoad | null;
  commands: MessagesDesignCommands;
  onClose: () => void;
}) {
  const runtime = useCanvasRuntime();
  const inspectorRef = useRef<HTMLElement>(null);
  const size = useHostSize(hostRef);
  const inspectorBounds = useInspectorBounds(hostRef, inspectorRef, runtime.viewport);
  const hostBounds = hostRef.current?.getBoundingClientRect();
  const nodeBounds = sourceNodeId ? runtime.getNodeScreenBounds(sourceNodeId) : null;
  const source = hostBounds && nodeBounds
    ? { x: nodeBounds.centerX - hostBounds.left, y: nodeBounds.centerY - hostBounds.top }
    : null;

  return (
    <div className="catenary-screen-layer">
      <SelectionTether
        source={source}
        inspector={inspectorBounds}
        width={size.width}
        height={size.height}
      />
      <LoadInspector
        ref={inspectorRef}
        selected={selected}
        graph={graph}
        load={load}
        commands={commands}
        onClose={onClose}
        onInspect={commands.select}
      />
    </div>
  );
}
