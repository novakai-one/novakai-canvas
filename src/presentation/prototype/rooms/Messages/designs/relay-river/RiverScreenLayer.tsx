import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanvasRuntime } from '../../../../components/canvas/canvas-runtime-context';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import { RiverInspector } from './RiverInspector';
import { RiverSelectionTether } from './RiverSelectionTether';

type MeasuredBounds = { left: number; top: number; width: number; height: number };

function useElementSize(elementRef: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);
  return size;
}

function useInspectorBounds(
  hostRef: RefObject<HTMLElement | null>,
  inspectorRef: RefObject<HTMLElement | null>,
  viewport: object,
): MeasuredBounds | null {
  const [bounds, setBounds] = useState<MeasuredBounds | null>(null);
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

/** Positions the inspector and its single source tether in the canvas screen plane. */
export function RiverScreenLayer({
  hostRef,
  graph,
  selected,
  sourceNodeId,
  commands,
  onClose,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  graph: ObjectGraph;
  selected: ObjectRecord;
  sourceNodeId: string | null;
  commands: MessagesDesignCommands;
  onClose: () => void;
}) {
  const runtime = useCanvasRuntime();
  const inspectorRef = useRef<HTMLElement>(null);
  const size = useElementSize(hostRef);
  const inspectorBounds = useInspectorBounds(hostRef, inspectorRef, runtime.viewport);
  const hostBounds = hostRef.current?.getBoundingClientRect();
  const nodeBounds = sourceNodeId ? runtime.getNodeScreenBounds(sourceNodeId) : null;
  const source = hostBounds && nodeBounds ? {
    x: nodeBounds.centerX - hostBounds.left,
    y: nodeBounds.centerY - hostBounds.top,
  } : null;

  return (
    <div className="river-screen-layer">
      <RiverSelectionTether
        source={source}
        inspector={inspectorBounds}
        width={size.width}
        height={size.height}
      />
      <RiverInspector
        ref={inspectorRef}
        graph={graph}
        selected={selected}
        commands={commands}
        onClose={onClose}
        onInspect={commands.select}
      />
    </div>
  );
}
