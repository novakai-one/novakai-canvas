import { describe, expect, it } from 'vitest';
import { defaultPreferences } from '../domain/defaults';
import { wireLabelSizing } from './wire-styles';

describe('wireLabelSizing', () => {
  it('uses node-title size as the default semantic-zoom boundary', () => {
    expect(wireLabelSizing(defaultPreferences)).toEqual({
      baseSize: 12,
      maximumSize: 13,
      minimumZoom: 12 / 13,
    });
  });

  it('derives one cutoff from the chosen type scales and maximum', () => {
    const preferences = {
      ...defaultPreferences,
      appearance: { ...defaultPreferences.appearance, textScale: 1.25 },
      wires: { ...defaultPreferences.wires, labelScale: 0.9, maxLabelSize: 18 },
    };
    expect(wireLabelSizing(preferences)).toEqual({
      baseSize: 13.5,
      maximumSize: 18,
      minimumZoom: 0.75,
    });
  });
});
