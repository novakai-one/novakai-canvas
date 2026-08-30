/**
 * Stored appearance in, complete appearance out.
 *
 * A stored record leaves out every field the author did not choose. `resolveAppearanceTokens`
 * is the one place those gaps become values: each gap takes the omitted-value meaning the
 * specification table declares, and `resolveNodeAppearance` in `core/domain` consumes these
 * tokens to turn them into concrete CSS. Colour fields stay tokens here.
 */

import type { NodeAppearance } from '../../contract/schemas/node-appearance.ts';
import {
  appearanceSpecification, canonicalNodeAppearance,
} from '../../contract/schemas/node-appearance-authoring.ts';

/**
 * What a field means when the author stored nothing. Each value sits outside its stored union,
 * so a reader can always tell a stored choice from an absent one.
 */
interface AppearanceFallbacks {
  icon: 'none';
  palette: 'none';
  shape: 'rect';
}

type Fallback<Key extends keyof NodeAppearance> =
  Key extends keyof AppearanceFallbacks ? AppearanceFallbacks[Key] : never;

/** Every stored appearance field, filled in. Mirrors the stored record field for field. */
export type AppearanceTokens = {
  readonly [Key in keyof NodeAppearance]-?: NodeAppearance[Key] | Fallback<Key>;
};

/** Shortens the table reads below; each call site's literal key keeps its literal types. */
const specified = appearanceSpecification;

/**
 * Every gap's value, read from the specification table so what omission means is declared
 * once. Only `palette` is local: the table leaves its omitted meaning to each registered
 * component, while the tokens always carry the out-of-band marker.
 */
const DEFAULTS = {
  icon: specified('icon').omitted,
  font: specified('font').omitted,
  size: specified('size').omitted,
  weight: specified('weight').omitted,
  align: specified('align').omitted,
  verticalAlign: specified('vertical-align').omitted,
  text: specified('text').omitted,
  background: specified('background').omitted,
  shape: specified('shape').omitted,
  borderColor: specified('border-color').omitted,
  border: specified('border').omitted,
  radius: specified('radius').omitted,
  padding: specified('padding').omitted,
  badge: specified('badge').omitted,
  palette: 'none',
} satisfies AppearanceTokens;

/** Fills every absent field with the table's omitted meaning. An absent record gets them all. */
export function resolveAppearanceTokens(stored: NodeAppearance | undefined): AppearanceTokens {
  return { ...DEFAULTS, ...canonicalNodeAppearance(stored ?? {}) };
}
