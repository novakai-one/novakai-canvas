import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanvasRuntime } from '../../../../components/canvas/canvas-runtime-context';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { ObjectGraph } from '../../../../object-graph/graph';
import type { MessagesDesignCommands } from '../../messages-design';
import { AtlasSelectionTether, type InspectorBounds } from './AtlasSelectionTether';
import { CartographicInspector } from './CartographicInspector';

/** Inspector and selection tether rendered in the canvas screen plane. */
export function AtlasScreenLayer({
  containerRef,
  graph,
  selected,
  trail,
  commands,
  onTraverse,
  onFocus,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  graph: ObjectGraph;
  selected: ObjectRecord;
  trail: readonly ObjectRecord[];
  commands: MessagesDesignCommands;
  onTraverse(threadId: string): void;
  onFocus(id: string): void;
}) {
  const runtime = useCanvasRuntime();
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [inspectorBounds, setInspectorBounds] = useState<InspectorBounds | null>(null);

  const hostBounds = containerRef.current?.getBoundingClientRect();
  const nodeBounds = runtime.getNodeScreenBounds(selected.id);
  const selectedPoint = hostBounds && nodeBounds
    ? {
        x: nodeBounds.centerX - hostBounds.left,
        y: nodeBounds.centerY - hostBounds.top,
      }
    : null;
  const inspectorHeight = inspectorBounds?.height ?? 520;
  const inspectorTop = selectedPoint
    ? Math.max(24, Math.min(
        selectedPoint.y - 112,
        containerSize.height - inspectorHeight - 24,
      ))
    : 24;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const inspector = inspectorRef.current;
    const container = containerRef.current;
    if (!inspector || !container) return;

    const measure = () => {
      const inspectorBox = inspector.getBoundingClientRect();
      const containerBox = container.getBoundingClientRect();
      setInspectorBounds({
        left: inspectorBox.left - containerBox.left,
        top: inspectorBox.top - containerBox.top,
        width: inspectorBox.width,
        height: inspectorBox.height,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(inspector);
    measure();
    return () => observer.disconnect();
  }, [containerRef, inspectorTop, runtime.viewport]);

  const inspect = (id: string) => commands.select(graph.get(id) ?? null);

  return (
    <>
      <CartographicInspector
        ref={inspectorRef}
        graph={graph}
        selected={selected}
        trail={trail}
        style={{ top: inspectorTop }}
        onClose={() => commands.select(null)}
        onInspect={inspect}
        canOpen={commands.canOpen}
        onOpen={commands.open}
        onTraverse={onTraverse}
        onFocus={onFocus}
      />
      <AtlasSelectionTether
        point={selectedPoint}
        inspector={inspectorBounds}
        width={containerSize.width}
        height={containerSize.height}
      />
    </>
  );
}
