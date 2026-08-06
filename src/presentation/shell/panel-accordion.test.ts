import { describe, expect, it } from 'vitest';
import { resolveOpenSection } from './panel-accordion';

const SECTIONS = ['description', 'interfaces', 'placement'] as const;

describe('panel accordion', () => {
  it('opens exactly one section and closes its siblings', () => {
    const isOpen = resolveOpenSection('accordion', SECTIONS, 'interfaces');
    expect(SECTIONS.filter(isOpen)).toEqual(['interfaces']);
  });

  it('opens the first section before anything has been touched', () => {
    const isOpen = resolveOpenSection('accordion', SECTIONS, null);
    expect(SECTIONS.filter(isOpen)).toEqual(['description']);
  });

  it('never leaves a panel with nothing open when the remembered id has retired', () => {
    const isOpen = resolveOpenSection('accordion', SECTIONS, 'facts-was-deleted');
    expect(SECTIONS.filter(isOpen)).toEqual(['description']);
  });

  it('opens everything when the user has asked for all-open', () => {
    const isOpen = resolveOpenSection('all-open', SECTIONS, 'interfaces');
    expect(SECTIONS.filter(isOpen)).toEqual([...SECTIONS]);
  });
});
