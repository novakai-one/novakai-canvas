import type {
  CanvasTheme, ThemePalette, ThemePresetId, ThemeSemanticPalette,
} from '../../contract/records/preferences.ts';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  mode: CanvasTheme;
  colors: ThemePalette;
}

/** Six restrained starting points. These are the only authored base colour values. */
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  carbon: {
    id: 'carbon', label: 'Carbon', mode: 'dark',
    colors: {
      canvas: '#0B0E12', panel: '#11161C', surface: '#182029', raised: '#222C37',
      border: '#344150', text: '#EEF3F7', muted: '#98A5B3', accent: '#6D9FC7',
    },
  },
  midnight: {
    id: 'midnight', label: 'Midnight', mode: 'dark',
    colors: {
      canvas: '#070D18', panel: '#0D1624', surface: '#142238', raised: '#1B2D47',
      border: '#2D4664', text: '#EDF4FB', muted: '#91A6BC', accent: '#74A9D8',
    },
  },
  plum: {
    id: 'plum', label: 'Plum', mode: 'dark',
    colors: {
      canvas: '#100D14', panel: '#18121D', surface: '#211927', raised: '#2D2235',
      border: '#493751', text: '#F3EEF5', muted: '#AA9BAF', accent: '#AE8AC1',
    },
  },
  frost: {
    id: 'frost', label: 'Frost', mode: 'light',
    colors: {
      canvas: '#E7ECF1', panel: '#EEF2F5', surface: '#F8FAFB', raised: '#FFFFFF',
      border: '#C5CED7', text: '#17212B', muted: '#61707E', accent: '#3E749E',
    },
  },
  porcelain: {
    id: 'porcelain', label: 'Porcelain', mode: 'light',
    colors: {
      canvas: '#E5EAEC', panel: '#EDF0F2', surface: '#FAFBFB', raised: '#FFFFFF',
      border: '#C8D0D5', text: '#1B242B', muted: '#66727B', accent: '#466F91',
    },
  },
  blueprint: {
    id: 'blueprint', label: 'Blueprint', mode: 'light',
    colors: {
      canvas: '#E6EDF4', panel: '#EDF3F8', surface: '#F8FBFD', raised: '#FFFFFF',
      border: '#BECBD7', text: '#162432', muted: '#5A6D7D', accent: '#326B98',
    },
  },
};

/** Status colours are semantic, mode-aware, and deliberately absent from user settings. */
export const THEME_SEMANTICS: Record<CanvasTheme, ThemeSemanticPalette> = {
  dark: {
    blue: '#78A7D1', violet: '#AA91D1', sage: '#7CAD8A', rose: '#C58E9D',
    amber: '#D5A75C', danger: '#D2796D',
  },
  light: {
    blue: '#477BA8', violet: '#7059A0', sage: '#4F7C5C', rose: '#945A69',
    amber: '#966A28', danger: '#A44F43',
  },
};
