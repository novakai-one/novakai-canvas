import { Handle, Position } from '@xyflow/react';
import { NODE_PORTS } from '../../domain/axis';

const PORT_POSITION = {
  top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right,
} as const;

/**
 * Every side of a node offers one port, and that port both gives and takes a wire.
 *
 * One source at the bottom and one target at the top meant a wire could only ever run downward,
 * and dropping an end on any other side was a silent no-op. One handle per side — rather than an
 * overlapping source/target pair, which strict mode refuses to join because the drop lands on
 * whichever of the two sits on top — is what makes "drag this end to that side and have it
 * stick" true. The canvas runs `ConnectionMode.Loose` so a single handle serves as either end.
 *
 * Shared by every node kind on purpose: the port ids are the side names, and an edge stores the
 * side it was dropped on by that name. A node kind rendering a different set would leave edges
 * pointing at handles that are not there.
 */
export function NodePorts({ connectable }: { connectable: boolean }) {
  return (
    <>
      {NODE_PORTS.map((side) => (
        <Handle
          id={side}
          isConnectable={connectable}
          key={side}
          position={PORT_POSITION[side]}
          type="source"
        />
      ))}
    </>
  );
}
