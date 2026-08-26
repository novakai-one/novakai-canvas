import { useEffect, useState } from 'react';
import type {
  CanvasPreferences, ThemeColorRole, ThemePresetId,
} from '@novakai/canvas';
import {
  resolveCanvasTheme, THEME_COLOR_ROLES, THEME_PRESETS, THEME_PRESET_IDS,
  themeContrastRatio,
} from '@novakai/canvas';
import { FieldRow, PanelSection } from '../shell';

const ROLE_LABELS: Record<ThemeColorRole, string> = {
  canvas: 'Canvas',
  panel: 'Panel',
  surface: 'Surface',
  raised: 'Raised surface',
  border: 'Border',
  text: 'Text',
  muted: 'Muted text',
  accent: 'Accent',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function ColorRoleEditor({
  color, label, onChange, role,
}: {
  color: string;
  label: string;
  onChange: (role: ThemeColorRole, color: string) => void;
  role: ThemeColorRole;
}) {
  const [draft, setDraft] = useState(color);
  useEffect(() => setDraft(color), [color]);
  const commit = (value: string) => {
    setDraft(value);
    if (HEX_COLOR.test(value)) onChange(role, value.toUpperCase());
  };
  return (
    <FieldRow label={label}>
      <span className="theme-color-inputs">
        <input
          aria-label={`${label} colour picker`}
          onChange={(event) => commit(event.target.value)}
          type="color"
          value={color}
        />
        <input
          aria-label={`${label} hex colour`}
          data-invalid={!HEX_COLOR.test(draft) || undefined}
          maxLength={7}
          onBlur={() => setDraft(color)}
          onChange={(event) => commit(event.target.value)}
          spellCheck={false}
          value={draft}
        />
      </span>
    </FieldRow>
  );
}

function contrastWarnings(preferences: CanvasPreferences): string[] {
  const { colors } = resolveCanvasTheme(preferences.appearance);
  return [
    themeContrastRatio(colors.text, colors.surface) < 4.5
      ? 'Text may be difficult to read on surfaces.' : '',
    themeContrastRatio(colors.muted, colors.surface) < 3
      ? 'Muted text may be difficult to read on surfaces.' : '',
    themeContrastRatio(colors.accent, colors.canvas) < 3
      ? 'Accent controls may be difficult to see on the canvas.' : '',
  ].filter(Boolean);
}

/** Six curated presets plus the eight intentional user-editable colour roles. */
export function ThemePreferences({
  patch, value,
}: {
  value: CanvasPreferences;
  patch: (appearance: CanvasPreferences['appearance']) => void;
}) {
  const appearance = value.appearance;
  const theme = resolveCanvasTheme(appearance);
  const modified = Object.keys(appearance.overridesByPreset[appearance.preset] ?? {}).length > 0;
  const updateColor = (role: ThemeColorRole, color: string) => patch({
    ...appearance,
    overridesByPreset: {
      ...appearance.overridesByPreset,
      [appearance.preset]: {
        ...appearance.overridesByPreset[appearance.preset],
        [role]: color,
      },
    },
  });
  const reset = () => {
    const overridesByPreset = { ...appearance.overridesByPreset };
    delete overridesByPreset[appearance.preset];
    patch({ ...appearance, overridesByPreset });
  };
  const warnings = contrastWarnings(value);

  return (
    <>
      <PanelSection title="Theme">
        <FieldRow hint={theme.mode === 'dark' ? 'Dark' : 'Light'} label="Preset">
          <select
            onChange={(event) => patch({
              ...appearance, preset: event.target.value as ThemePresetId,
            })}
            value={appearance.preset}
          >
            {THEME_PRESET_IDS.map((preset) => (
              <option key={preset} value={preset}>{THEME_PRESETS[preset].label}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow hint={`${appearance.radius}px`} label="Corner radius">
          <input max="16" min="0" onChange={(event) => patch({
            ...appearance, radius: Number(event.target.value),
          })} type="range" value={appearance.radius} />
        </FieldRow>
        <FieldRow label="Density">
          <select onChange={(event) => patch({
            ...appearance,
            density: event.target.value as CanvasPreferences['appearance']['density'],
          })} value={appearance.density}>
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="roomy">Roomy</option>
          </select>
        </FieldRow>
        <FieldRow hint={`${Math.round((appearance.textScale ?? 1) * 100)}%`} label="Text size">
          <input max="1.35" min="0.85" onChange={(event) => patch({
            ...appearance, textScale: Number(event.target.value),
          })} step="0.05" type="range" value={appearance.textScale ?? 1} />
        </FieldRow>
      </PanelSection>
      <PanelSection
        title={`Colours${modified ? ' · Modified' : ''}`}
        trailing={<button className="theme-reset" disabled={!modified} onClick={reset}
          type="button">Reset current theme</button>}
      >
        {THEME_COLOR_ROLES.map((role) => (
          <ColorRoleEditor color={theme.colors[role]} key={role} label={ROLE_LABELS[role]}
            onChange={updateColor} role={role} />
        ))}
        {warnings.map((warning) => (
          <p className="theme-contrast-warning" key={warning} role="status">{warning}</p>
        ))}
      </PanelSection>
    </>
  );
}
