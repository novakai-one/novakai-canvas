import { describe, expect, it } from 'vitest';
import { parseDsl } from '@novakai/canvas';

const HEAD = 'scope Demo\n  module A\n  module B\n  wire A -> B : call [references]\n';

describe('flow step labels', () => {
  it('parses an optional quoted label after the wire id', () => {
    const { scopes, errors } = parseDsl(`${HEAD}  flow Path\n    step 1 "demo--wire-1" "save()"\n    step 2 "demo--wire-1"\n  end\n`);
    expect(errors).toEqual([]);
    expect(scopes[0].flows[0].steps).toMatchObject([
      { ordinal: 1, ref: 'demo--wire-1', label: 'save()' },
      { ordinal: 2, ref: 'demo--wire-1' },
    ]);
    expect('label' in scopes[0].flows[0].steps[1]).toBe(false);
  });

  it('rejects an empty label and anything after it', () => {
    const empty = parseDsl(`${HEAD}  flow Path\n    step 1 "demo--wire-1" ""\n  end\n`);
    expect(empty.errors.some((error) => error.message.includes('empty step label'))).toBe(true);
    const extra = parseDsl(`${HEAD}  flow Path\n    step 1 "demo--wire-1" "save()" trailing\n  end\n`);
    expect(extra.errors.some((error) => error.message.includes('invalid flow step'))).toBe(true);
  });
});
