import type { ComponentPalette, Theme } from '../domain/node-appearance.ts';

export type ComponentPaletteFamily = 'entity' | 'ooux' | 'standard';

/** Concrete card slots shared by browser CSS variables and SVG attributes. */
export interface ComponentPaletteColors {
  frame: string;
  surface: string;
  header: string;
  headerText: string;
  headerMuted: string;
  text: string;
  muted: string;
  core: string;
  metadata: string;
  action: string;
}

const PALETTES: Record<Theme, Record<ComponentPalette, ComponentPaletteColors>> = {
  light: {
    neutral: {
      frame: '#5f6368', surface: '#fbfbfc', header: '#e8e9eb', headerText: '#202124',
      headerMuted: '#51555a', text: '#202124', muted: '#51555a', core: '#f1f2f3',
      metadata: '#e7e9ec', action: '#dde1e4',
    },
    blue: {
      frame: '#496f9c', surface: '#f8fbff', header: '#647f9b', headerText: '#ffffff',
      headerMuted: '#ffffff', text: '#1f2a35', muted: '#4c5967', core: '#e5effa',
      metadata: '#dbe8f5', action: '#cfdfef',
    },
    violet: {
      frame: '#6f579c', surface: '#fbf9ff', header: '#796c8e', headerText: '#ffffff',
      headerMuted: '#eee7fb', text: '#292431', muted: '#57505f', core: '#eee8f8',
      metadata: '#e4dcf2', action: '#d9ceeb',
    },
    sage: {
      frame: '#4f7b5b', surface: '#f8fcf8', header: '#4f7b5b', headerText: '#ffffff',
      headerMuted: '#ffffff', text: '#222b24', muted: '#4b5b4f', core: '#e7f1e8',
      metadata: '#dcebdd', action: '#cee2d1',
    },
  },
  dark: {
    neutral: {
      frame: '#979aa1', surface: '#242529', header: '#383a40', headerText: '#f2f2f3',
      headerMuted: '#c5c7cb', text: '#ececee', muted: '#b8bac0', core: '#2f3136',
      metadata: '#383a40', action: '#41444a',
    },
    blue: {
      frame: '#7f9fc7', surface: '#1b222b', header: '#34465a', headerText: '#f5f8fc',
      headerMuted: '#c7d9ee', text: '#edf2f8', muted: '#b8c5d3', core: '#243142',
      metadata: '#2a3950', action: '#31445d',
    },
    violet: {
      frame: '#a08ac8', surface: '#241f2b', header: '#493f58', headerText: '#f8f5fc',
      headerMuted: '#d8caec', text: '#f0ecf5', muted: '#c5bbcf', core: '#31283d',
      metadata: '#3a2f49', action: '#443756',
    },
    sage: {
      frame: '#78a886', surface: '#1b261f', header: '#365a42', headerText: '#f4f8f5',
      headerMuted: '#c9ddcf', text: '#edf3ef', muted: '#b8c9bd', core: '#243329',
      metadata: '#2b3d31', action: '#344a3b',
    },
  },
};

/** Resolves one optional preset; standard cards preserve their existing look when omitted. */
export function resolveComponentPalette(
  palette: ComponentPalette | undefined,
  theme: Theme,
  family: ComponentPaletteFamily,
): ComponentPaletteColors | undefined {
  if (palette === undefined && family === 'standard') return undefined;
  const resolved = palette ?? (family === 'entity' ? 'violet' : 'blue');
  return PALETTES[theme][resolved];
}

/** Converts resolved slots to the one CSS-variable vocabulary used by card renderers. */
export function paletteCssVariables(colors: ComponentPaletteColors): Record<string, string> {
  return {
    '--component-frame': colors.frame,
    '--component-surface': colors.surface,
    '--component-header': colors.header,
    '--component-header-text': colors.headerText,
    '--component-header-muted': colors.headerMuted,
    '--component-text': colors.text,
    '--component-muted': colors.muted,
    '--component-core': colors.core,
    '--component-metadata': colors.metadata,
    '--component-action': colors.action,
  };
}
