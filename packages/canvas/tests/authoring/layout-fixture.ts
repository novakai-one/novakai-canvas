import type { DiagramRecord } from '@novakai/canvas';
import { buildRecord } from '../fixtures/dsl.ts';
import { estimateNodeSize } from '@novakai/canvas';
import { layoutInitialRecord, placementsOf } from '@novakai/canvas';

export const DSL = `
scope "Browser Sessions"
  note "One session per instance; renders off-screen so the foreground never moves."
  module "browse CLI" "Entry point for agents"
    goto(Url) -> ActionResult
  module "Session broker" "Owns leases and allocation"
    acquire(AgentId) -> SessionHandle
    release(SessionId) -> void
  module "CDP control"
    act(SessionId, BrowserCommand) -> ActionResult
  runtime "Chrome instances"
  resource "sessions.json"
  wire "browse CLI" -> "Session broker" : acquire(AgentId) -> SessionHandle [queries]
  wire "Session broker" -> "Chrome instances" : launch(LaunchSpec) -> BrowserInstance [owns]
  wire "CDP control" -> "Chrome instances" : CDP Page.* commands [executes]
`;

interface Rect { x: number; y: number; width: number; height: number }

export function placement(record: DiagramRecord, id: string) {
  return placementsOf(record)[id];
}

export function rect(record: DiagramRecord, id: string): Rect {
  const found = placement(record, id);
  return { x: found.position.x, y: found.position.y, ...found.size };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}


export { buildRecord, estimateNodeSize, layoutInitialRecord, placementsOf };
