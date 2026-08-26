import { describe, expect, it } from "vitest";
import { buildRecord, content, printRecord } from "./dsl-print-fixture.ts";

describe('printRecord with nested zones', () => {
  const ZONED_DSL = `
scope "Mission Map"
  zone "Stores"
    module "missions.jsonl"
      type Mission { id, title }
    zone "Archive"
      module "old store"
    end
  end
  zone "Standalone — no mission"
    module "orphan task"
  end
  module "Mission Room"
  wire "missions.jsonl" -> "Mission Room" : read() -> Rows [queries]
  wire "Stores" -> "Archive" : keeps [owns]
`;

  it('prints nested groups as zone/end blocks with wires at scope level', () => {
    const output = printRecord(buildRecord(ZONED_DSL));
    expect(output).toContain('zone "Stores"');
    expect(output).toContain('zone "Archive"');
    expect(output).toContain('zone "Standalone — no mission"');
    expect(output.match(/^  end$/gm)).toHaveLength(2);
    expect(output).toContain('wire "Stores" -> "Archive" : keeps [owns]');
    expect(output).not.toContain('scope "Archive"');
  });

  it('round-trips nested zones: re-applying the print reproduces the structure', () => {
    const record = buildRecord(ZONED_DSL);
    const reapplied = buildRecord(printRecord(record), { [record.id]: record });
    expect(content(reapplied)).toEqual(content(record));
  });
});
