import { expect } from 'vitest';
import { exportDiagram, type DiagramRecord } from '@novakai/canvas';
import { parseDsl } from '@novakai/canvas';
import { compile } from '@novakai/canvas';
import { buildRecords } from '../fixtures/dsl.ts';

export function printRecord(record: DiagramRecord): string {
  return exportDiagram(record, { records: { [record.id]: record }, links: [] }, 'dsl');
}

/**
 * Two records standing in for the shape of the real library: one map holding `Session`, another
 * holding `Agents`, so a wire between them has to cross a record boundary.
 */
export function fixture(): Record<string, DiagramRecord> {
  return buildRecords(`
scope "Novakai IDE"
  module Planning
    create(Plan) -> PlanId
  module Session
  module Agent

scope "Agent Messaging"
  module Agents
    notify(Message) -> void
    type Envelope { id, from }
`).records;
}

export function parseOk(source: string) {
  const { scopes, errors } = parseDsl(source);
  expect(errors).toEqual([]);
  return scopes;
}


export { buildRecords, compile };
