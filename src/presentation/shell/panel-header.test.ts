import { describe, expect, it } from 'vitest';
import { titleCommit } from './panel-header';

/**
 * The panel title's commit rule.
 *
 * The field used to rename per keystroke straight off the record, and the diagram rename
 * trimmed as it went — so a trailing space never landed ("My Diagram" was untypeable) and an
 * emptied field snapped back. Typing is a draft now; these are the rules for the one moment
 * the draft becomes a name.
 */
describe('title commit', () => {
  it('keeps interior spaces — the per-keystroke trim ate them', () => {
    expect(titleCommit('My Diagram', 'Untitled diagram')).toBe('My Diagram');
  });

  it('trims the ends at commit time, not while typing', () => {
    expect(titleCommit('  Agent Messaging  ', 'Untitled diagram')).toBe('Agent Messaging');
  });

  it('commits nothing when the edit trims to empty, so the field reverts instead', () => {
    expect(titleCommit('', 'A diagram')).toBeNull();
    expect(titleCommit('   ', 'A diagram')).toBeNull();
  });

  it('commits nothing when the name is unchanged', () => {
    expect(titleCommit('A diagram', 'A diagram')).toBeNull();
  });
});
