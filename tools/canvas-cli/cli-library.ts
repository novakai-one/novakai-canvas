/** Maps, read, remove and batch verbs for an opened library. */

import { randomUUID } from 'node:crypto';
import {
  createDiagramExportService,
  type CrossDiagramLink, type DiagramRecord, type RecordCommand,
} from '../../src/canvas.ts';
import type { CliArgs } from './cli-args.ts';
import { diagramIdOrFail, fail, readStdinOr } from './cli-args.ts';
import { COMMAND_KINDS } from './cli-contract.ts';
import { readAllRecords, type OpenedLibrary } from './library-io.ts';
import { removalCommandsFor } from './record-apply.ts';
import { rootGroupId } from '../../src/diagram-export/ordering.ts';
import { slugify } from '../../src/authoring/slug.ts';

/** One map as the `maps` listing shows it. */
export interface MapSummary {
  id: string;
  label: string;
  nodes: number;
  wires: number;
}

/** Lists maps in record order with their visible node and wire counts. */
export function listMaps(
  records: readonly DiagramRecord[],
  links: readonly CrossDiagramLink[] = [],
): MapSummary[] {
  return records.map((record) => {
    const rootId = rootGroupId(record);
    const outbound = links.filter((link) => link.source.diagramId === record.id).length;
    return {
      id: record.id as string,
      label: (rootId ? record.nodes[rootId]?.label : undefined) ?? record.name,
      nodes: Object.keys(record.nodes).length - (rootId ? 1 : 0),
      wires: Object.keys(record.wires).length + outbound,
    };
  });
}

export async function runMaps(opened: OpenedLibrary): Promise<void> {
  const records = await readAllRecords(opened.repository, opened.library);
  const maps = listMaps(
    opened.library.list({ includeArchived: true }).map((summary) => records[summary.id]),
    Object.values(opened.library.index().links),
  );
  const width = Math.max(...maps.map((map) => map.id.length), 2);
  for (const map of maps) {
    process.stdout.write(`${map.id.padEnd(width)}  ${String(map.nodes).padStart(3)} nodes  ${String(map.wires).padStart(3)} wires  ${map.label}\n`);
  }
}

export async function runRead(opened: OpenedLibrary, args: CliArgs): Promise<void> {
  let selected: DiagramRecord[];
  if (args.positional[0]) {
    selected = [await opened.repository.readDiagram(
      diagramIdOrFail(opened.library, args.positional[0]),
    )];
  } else {
    const records = await readAllRecords(opened.repository, opened.library);
    selected = opened.library.list({ includeArchived: true })
      .map((summary) => records[summary.id]);
  }
  const exporter = createDiagramExportService(opened.repository, opened.library);
  process.stdout.write(await exporter.render(selected, args.format ?? 'dsl'));
}

export async function runRemove(opened: OpenedLibrary, args: CliArgs): Promise<void> {
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);
  if (!args.positional[1]) {
    const outcome = await opened.library.remove(diagramId);
    if (outcome !== true) {
      if (outcome.status === 'inbound-links-exist') {
        fail(`refusing to remove "${diagramId}": other maps link to it (${outcome.links.join(', ')})`);
      }
      fail(`could not remove "${diagramId}": ${outcome.status}`);
    }
    process.stdout.write(`removed: ${diagramId}\n`);
    return;
  }
  const workspace = await opened.library.open(diagramId);
  if (!('snapshot' in workspace)) fail(`could not open "${diagramId}": ${workspace.status}`);
  const record = workspace.snapshot();
  const nameSlug = slugify(args.positional[1]);
  const matches = Object.values(record.nodes).filter((node) => slugify(node.label) === nameSlug);
  if (matches.length > 1) {
    fail(`node "${args.positional[1]}" is ambiguous in ${diagramId}; use a unique label before removing it`);
  }
  const target = matches[0];
  if (!target) fail(`no node "${args.positional[1]}" in ${diagramId}`);
  const outcome = workspace.submit({
    operationId: args.operationId ?? `cli-rm-${randomUUID()}`,
    expectedRevision: record.revision,
    timestamp: new Date().toISOString(),
    commands: removalCommandsFor(record, target.id as string),
  });
  if (outcome.status !== 'applied') fail(`rm ${outcome.status}: ${JSON.stringify(outcome)}`);
  const written = await opened.repository.writeDiagram(workspace.snapshot(), record.revision);
  if (written.status !== 'written') fail(`rm save ${written.status}`);
  await opened.library.rebuildIndex();
  process.stdout.write(`removed: ${target.label} (revision ${written.revision})\n`);
}

export async function runBatch(opened: OpenedLibrary, args: CliArgs): Promise<void> {
  if (args.positional.length === 0) fail('batch needs a map: ./canvas batch <map> [json-file]');
  const diagramId = diagramIdOrFail(opened.library, args.positional[0]);
  const source = readStdinOr(
    args.positional[1], 'batch needs JSON: pass a file, or pipe it in. See ./canvas describe',
  );
  const parsed = JSON.parse(source) as {
    operationId?: unknown; expectedRevision?: unknown; timestamp?: unknown; commands?: unknown;
  };
  if (typeof parsed.operationId !== 'string' || !Array.isArray(parsed.commands)) {
    fail('a change set needs an operationId and a commands array. See ./canvas describe');
  }
  const commands = parsed.commands as RecordCommand[];
  for (const command of commands) {
    if (!COMMAND_KINDS.includes(command?.kind as (typeof COMMAND_KINDS)[number])) {
      fail(`unknown command kind "${String(command?.kind)}". See ./canvas describe`);
    }
  }
  const workspace = await opened.library.open(diagramId);
  if (!('snapshot' in workspace)) fail(`could not open "${diagramId}": ${workspace.status}`);
  const before = workspace.snapshot();
  const outcome = workspace.submit({
    operationId: parsed.operationId,
    expectedRevision: typeof parsed.expectedRevision === 'number' ? parsed.expectedRevision : before.revision,
    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
    commands,
  });
  if (outcome.status === 'applied') {
    const written = await opened.library.save(diagramId);
    if (written.status !== 'written') fail(`batch save ${written.status}`);
  }
  process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
  if (outcome.status === 'conflict' || outcome.status === 'rejected') process.exitCode = 2;
}
