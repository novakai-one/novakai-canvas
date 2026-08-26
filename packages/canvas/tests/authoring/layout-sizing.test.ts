import { describe, expect, it } from 'vitest';
import { estimateNodeSize } from './layout-fixture.ts';

describe('estimateNodeSize', () => {
  it('budgets generously enough for a described two-interface card', () => {
    const size = estimateNodeSize(
      'Threads', 'Groups messages into ordered conversations agents can follow.',
      ['create(CreateThread) -> Thread', 'append(ThreadId, Envelope) -> Receipt'], [],
    );
    expect(size.height).toBeGreaterThanOrEqual(150);
    expect(size.width).toBeGreaterThanOrEqual(240);
    expect(size.width).toBeLessThanOrEqual(300);
  });

  it('uses a constrained manual width and grows height for wrapped content', () => {
    const description = 'Groups messages into ordered conversations agents can follow.';
    const automatic = estimateNodeSize('Threads', description, [], []);
    const constrained = estimateNodeSize('Threads', description, [], [], 160);

    expect(constrained.width).toBe(160);
    expect(constrained.height).toBeGreaterThan(automatic.height);
  });
});
