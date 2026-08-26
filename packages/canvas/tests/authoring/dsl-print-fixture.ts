import {
  exportDiagram, exportDiagrams, type DiagramExportContext, type DiagramRecord,
} from '@novakai/canvas';
export { buildRecord, buildRecords } from '../fixtures/dsl.ts';

export function printRecord(record: DiagramRecord, context?: DiagramExportContext): string {
  return exportDiagram(record, context ?? { records: { [record.id]: record }, links: [] }, 'dsl');
}

export function printLibrary(records: readonly DiagramRecord[]): string {
  return exportDiagrams(
    records, { records: Object.fromEntries(records.map((record) => [record.id, record])), links: [] }, 'dsl',
  );
}

export const DSL = `
scope "Browser Sessions" "Isolated per-agent browsing"
  note "One session per instance."
  module "browse CLI" "Entry point"
    goto(Url) -> ActionResult
  module "Session broker"
    acquire(AgentId) -> SessionHandle
    type Lease { agentId, ttl }
  wire "browse CLI" -> "Session broker" shape=curved : acquire(AgentId) -> SessionHandle [queries]
  wire "Session broker" -> "browse CLI" : ack(SessionHandle) -> void
`;

/** Content is what a round trip has to preserve; ids and revisions are storage, not meaning. */
export function content(record: DiagramRecord) {
  return {
    nodes: record.nodes, interfaces: record.interfaces, types: record.types,
    wires: record.wires, flows: record.flows,
  };
}
