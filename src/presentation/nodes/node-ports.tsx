import { Handle, Position } from '@xyflow/react';
import { NODE_PORTS } from '../../domain/node-port';
import { portAxisFraction, portHandleId } from '../../domain/interface-signature';
import { interfaceRowCenter } from '../../components/card/measure';
import type { InterfaceObject } from '../../domain/model';
import type { CanvasNode, PortSide } from '../../domain/records';

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
interface NodePortsProps {
  connectable: boolean;
  methods?: readonly InterfaceObject[];
  node?: Pick<CanvasNode, 'description'> & { size: { width: number } };
}

function methodPosition(
  side: PortSide,
  ordinal: number,
  count: number,
  node: NodePortsProps['node'],
) {
  if ((side === 'left' || side === 'right') && node) {
    return { top: interfaceRowCenter(node.description, node.size.width, ordinal) };
  }
  const offset = `${portAxisFraction(ordinal, count) * 100}%`;
  return side === 'top' || side === 'bottom' ? { left: offset } : { top: offset };
}

export function NodePorts({ connectable, methods = [], node }: NodePortsProps) {
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
      {NODE_PORTS.flatMap((side) => methods.map((method, ordinal) => (
        <Handle
          aria-label={`${method.name} ${side} port`}
          className="method-port"
          id={portHandleId({ side, ordinal })}
          isConnectable={connectable}
          key={`${side}:${method.id}`}
          position={PORT_POSITION[side]}
          style={methodPosition(side, ordinal, methods.length, node)}
          type="source"
        />
      )))}
    </>
  );
}
