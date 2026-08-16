import { useLayoutEffect, useState } from 'react';
import { useCanvasRuntime } from '../../../../components/canvas/canvas-runtime-context';

/** Connects the selected loom knot to the design-owned inspector. */
export function SelectionTether({
  nodeId,
  elected,
}: {
  nodeId: string | null;
  elected: boolean;
}) {
  const runtime = useCanvasRuntime();
  const [path, setPath] = useState('');

  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      const node = nodeId ? runtime.getNodeScreenBounds(nodeId) : null;
      const notch = document.querySelector<HTMLElement>('[data-loom-inspector-notch]');
      if (!node || !notch) {
        setPath('');
        frame = requestAnimationFrame(update);
        return;
      }

      const targetBounds = notch.getBoundingClientRect();
      const targetX = targetBounds.left + targetBounds.width / 2;
      const targetY = targetBounds.top + targetBounds.height / 2;
      const shoulder = node.centerX + Math.max(48, (targetX - node.centerX) * 0.42);
      setPath(
        `M ${node.centerX} ${node.centerY} C ${shoulder} ${node.centerY}, ${targetX - 64} ${targetY}, ${targetX} ${targetY}`,
      );
      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [nodeId, runtime]);

  if (!path) return null;
  return (
    <svg className="selection-tether" data-elected={elected} aria-hidden="true">
      <path className="selection-tether__bed" d={path} />
      <path className="selection-tether__line" d={path} />
    </svg>
  );
}
