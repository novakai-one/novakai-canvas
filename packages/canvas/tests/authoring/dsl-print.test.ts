import { describe, expect, it } from "vitest";
import { type CrossDiagramLink, type DiagramRecord } from "@novakai/canvas";
import { DSL, buildRecord, buildRecords, content, printRecord } from "./dsl-print-fixture.ts";

describe('printRecord', () => {
  it('prints contract on every wire and kind only when not the default', () => {
    const output = printRecord(buildRecord(DSL));
    expect(output).toContain('wire "browse CLI" -> "Session broker" shape=curved : acquire(AgentId) -> SessionHandle [queries]');
    expect(output).toContain('wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void');
    expect(output).not.toContain('[references]');
    expect(output).toContain('note "One session per instance."');
    expect(output).toContain('scope "Browser Sessions" "Isolated per-agent browsing"');
    expect(output).toContain('type Lease { agentId, ttl }');
  });

  it('round-trips: re-applying the printed map reproduces the same record content', () => {
    const record = buildRecord(DSL);
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
  });

  it('round-trips canonical flows without changing the basemap', () => {
    const record = buildRecord(`scope "Flow Round Trip"
  module A
  module B
  module C
  wire A -> B : first
  wire B -> C : second
  flow "Delivery"
    step 2 "flow-round-trip--wire-2"
    step 1 "flow-round-trip--wire-1" "save()"
  end`);
    const basemap = JSON.stringify([record.nodes, record.wires, record.layouts, record.views]);
    const printed = printRecord(record);
    expect(printed).toContain('step 1 "flow-round-trip--wire-1" "save()"\n    step 2 "flow-round-trip--wire-2"');
    const reapplied = buildRecord(printed, { [record.id]: record });
    expect(reapplied.flows).toEqual(record.flows);
    expect(JSON.stringify([reapplied.nodes, reapplied.wires, reapplied.layouts, reapplied.views])).toBe(basemap);
  });

  it('preserves node ids and placements for unchanged nodes across a re-apply', () => {
    const record = buildRecord(DSL);
    const layout = record.layouts[record.views[record.activeViewId].layoutId];
    layout.placements['browser-sessions--browse-cli'] = {
      ...layout.placements['browser-sessions--browse-cli'],
      position: { x: 640, y: 360 }, size: { width: 330, height: 180 },
      sizeMode: 'manual', pinned: true,
    };
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(Object.keys(reapplied.nodes).sort()).toEqual(Object.keys(record.nodes).sort());
    expect(reapplied.layouts[reapplied.views[reapplied.activeViewId].layoutId].placements)
      .toEqual(record.layouts[record.views[record.activeViewId].layoutId].placements);
  });

  it('canonically round-trips multiline block appearance and container arrangements', () => {
    const record = buildRecord(`
scope "Styled Round Trip" layout=grid columns=2 gap=24
  zone "Left" layout=stack gap=8 align=center
    block "Tasks:" padding=12 radius=8 border=1 border-color=green background=surface text=green vertical-align=center align=center weight=600 size=20
      line "• Safety"
      line "• Code"
  end
  zone "Right"
    module "Prompt" badge=hide
  end
`);
    const printed = printRecord(record);
    expect(printed).toContain('scope "Styled Round Trip" layout=grid columns=2 gap=24');
    expect(printed).toContain('zone "Left" layout=stack gap=8 align=center');
    expect(printed).toContain('block "Tasks:" size=20 weight=600 align=center vertical-align=center text=green background=surface border-color=green border=1 radius=8 padding=12');
    expect(printed).toContain('line "• Safety"\n      line "• Code"');
    expect(printed).toContain('module "Prompt" badge=hide');

    const reapplied = buildRecord(printed, { [record.id]: record });
    const layoutOf = (candidate: DiagramRecord) =>
      candidate.layouts[candidate.views[candidate.activeViewId].layoutId];
    expect(layoutOf(reapplied).appearanceByNodeId).toEqual(layoutOf(record).appearanceByNodeId);
    expect(layoutOf(reapplied).arrangementByContainerId).toEqual(layoutOf(record).arrangementByContainerId);
    expect(reapplied.nodes['styled-round-trip--left--block-tasks'].lines)
      .toEqual(['• Safety', '• Code']);
    expect(printRecord(reapplied)).toBe(printed);
  });

  it('prints a cross-diagram link as an ordinary wire, so read stays lossless', () => {
    const { records } = buildRecords(`
scope "Novakai IDE"
  module Session

scope "Agent Messaging"
  module Agents
`);
    const link = {
      id: 'session-agents', kind: 'references', label: 'is a',
      source: { diagramId: 'novakai-ide', nodeId: 'novakai-ide--session' },
      target: { diagramId: 'agent-messaging', nodeId: 'agent-messaging--agents' },
    } as unknown as CrossDiagramLink;
    const context = { links: [link], records };
    expect(printRecord(records['novakai-ide'], context)).toContain('wire "Session" -> "Agents" : is a');
    // The link is outbound from one map only; the other must not print it a second time.
    expect(printRecord(records['agent-messaging'], context)).not.toContain('is a');
  });
});
