import { describe, expect, it } from 'vitest';
import { estimateNodeSize } from './layout-fixture.ts';

describe('estimateNodeSize', () => {
  it('budgets generously enough for a described two-interface card', () => {
    const size = estimateNodeSize(
      'Threads', 'Groups messages into ordered conversations agents can follow.',
      ['create(CreateThread) -> Thread', 'append(ThreadId, Envelope) -> Receipt'], [],
    );
    expect(size.height).toBeGreaterThanOrEqual(150);
    expect(size.width).toBeGreaterThanOrEqual(200);
    expect(size.width).toBeLessThanOrEqual(420);
  });
});
