/** React Flow connection lifecycle adapter; durable command planning stays framework-free. */

import {
  useCallback, useEffect, useRef, useState, type RefObject,
} from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import type { RecordCommand } from '@novakai/canvas';
import type { Selection } from '@novakai/canvas';
import type { ProjectedView } from '@novakai/canvas';
import { placedNodes, type CreatableNodeKind, type WorldPoint } from '../canvas-actions.ts';
import {
  connectedNode, connectedWire, pickerPosition, reconnectedWire, sideOfHandle,
  type ConnectionOrigin, type PendingConnection,
} from './connection-commands.ts';

type FlowHandler<Key extends keyof ReactFlowProps> = NonNullable<ReactFlowProps[Key]>;

type ConnectionGestureMode = 'idle' | 'creating' | 'reconnecting' | 'pending-create';

interface ConnectionGestureInput {
  editable: boolean;
  resetKey: string;
  view: ProjectedView;
  executeAll: (commands: RecordCommand[]) => void;
  setSelection: (selection: Selection) => void;
  surface: RefObject<HTMLElement | null>;
  toWorld: (point: { x: number; y: number }) => WorldPoint;
}

interface ConnectionGestureResult {
  mode: ConnectionGestureMode;
  pendingConnection: PendingConnection | null;
  cancelPending: () => void;
  createFromPending: (kind: CreatableNodeKind) => void;
  handlers: {
    onConnect: FlowHandler<'onConnect'>;
    onConnectStart: FlowHandler<'onConnectStart'>;
    onConnectEnd: FlowHandler<'onConnectEnd'>;
    onReconnect: FlowHandler<'onReconnect'>;
    onReconnectStart: FlowHandler<'onReconnectStart'>;
    onReconnectEnd: FlowHandler<'onReconnectEnd'>;
  };
}

/** Owns mutually exclusive create/reconnect gestures and adapts accepted results to commands. */
export function useConnectionGestures(input: ConnectionGestureInput): ConnectionGestureResult {
  const { editable, executeAll, resetKey, setSelection, surface, toWorld, view } = input;
  const [mode, setMode] = useState<ConnectionGestureMode>('idle');
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const modeRef = useRef<ConnectionGestureMode>('idle');
  const dragFrom = useRef<ConnectionOrigin | null>(null);
  const transition = useCallback((next: ConnectionGestureMode): void => {
    modeRef.current = next;
    setMode(next);
  }, []);
  const cancelPending = useCallback((): void => {
    dragFrom.current = null;
    setPendingConnection(null);
    transition('idle');
  }, [transition]);

  useEffect(() => cancelPending(), [cancelPending, editable, resetKey]);

  const createFromPending = useCallback((kind: CreatableNodeKind): void => {
    if (!pendingConnection || !editable) return;
    const created = connectedNode(placedNodes(view), pendingConnection, kind);
    executeAll(created.commands);
    setSelection({ kind: 'node', id: created.nodeId });
    cancelPending();
  }, [cancelPending, editable, executeAll, pendingConnection, setSelection, view]);

  const onConnect = useCallback<FlowHandler<'onConnect'>>((connection) => {
    if (!editable || modeRef.current === 'reconnecting') return;
    const connected = connectedWire(connection);
    if (!connected) return;
    executeAll(connected.commands);
    setSelection({ kind: 'wire', id: connected.id });
    cancelPending();
  }, [cancelPending, editable, executeAll, setSelection]);

  const onConnectStart = useCallback<FlowHandler<'onConnectStart'>>((_event, params) => {
    if (modeRef.current === 'reconnecting') return;
    dragFrom.current = params.nodeId
      ? { nodeId: params.nodeId, side: sideOfHandle(params.handleId) }
      : null;
    transition('creating');
  }, [transition]);

  const onConnectEnd = useCallback<FlowHandler<'onConnectEnd'>>((event, state) => {
    if (modeRef.current === 'reconnecting') return;
    if (state.isValid) { cancelPending(); return; }
    const from = dragFrom.current;
    dragFrom.current = null;
    if (!editable || !from) { cancelPending(); return; }
    const point = 'changedTouches' in event
      ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
      : { x: event.clientX, y: event.clientY };
    const bounds = surface.current?.getBoundingClientRect();
    if (!bounds) { cancelPending(); return; }
    setPendingConnection({ from, world: toWorld(point), picker: pickerPosition(point, bounds) });
    transition('pending-create');
  }, [cancelPending, editable, surface, toWorld, transition]);

  const onReconnectStart = useCallback<FlowHandler<'onReconnectStart'>>(() => {
    dragFrom.current = null;
    setPendingConnection(null);
    transition('reconnecting');
  }, [transition]);

  const onReconnect = useCallback<FlowHandler<'onReconnect'>>((edge, connection) => {
    if (!editable) return;
    const commands = reconnectedWire(edge, connection);
    if (commands.length > 0) executeAll(commands);
    setSelection({ kind: 'wire', id: edge.id });
  }, [editable, executeAll, setSelection]);

  const onReconnectEnd = useCallback<FlowHandler<'onReconnectEnd'>>(() => {
    dragFrom.current = null;
    transition('idle');
  }, [transition]);

  return {
    mode, pendingConnection, cancelPending, createFromPending,
    handlers: {
      onConnect, onConnectStart, onConnectEnd, onReconnect, onReconnectStart, onReconnectEnd,
    },
  };
}
