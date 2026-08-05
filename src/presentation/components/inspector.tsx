import { useState } from 'react';
import type { CanvasPreferences, InspectorTab, PreferenceSection } from '../../domain/model';
import {
  IconButton, PanelBody, PanelHeader, PanelShell, STUDIO_BOUNDS, TabStrip, clampPanelWidth,
} from '../shell';
import { describeSelection, type InspectPanelProps } from './inspect-panel';
import { JsonPanel } from './json-panel';
import { PREFERENCE_SECTIONS, preferenceSectionMeta } from './preference-sections';
import { PreferenceControls } from './preferences-panel';

/** What the Studio inspects, plus the surfaces it can switch between. */
export interface InspectorProps extends InspectPanelProps {
  preferences: CanvasPreferences;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  updatePreferences: (preferences: CanvasPreferences) => void;
}

/** The surfaces the Studio offers for the selected object. Settings are not one of them. */
const OBJECT_TABS = ['inspect', 'json'] as const;
type ObjectTab = (typeof OBJECT_TABS)[number];

/** An older preference file may name a tab that is now a gear; it opens on Inspect instead. */
function objectTab(tab: InspectorTab): ObjectTab {
  return tab === 'json' ? 'json' : 'inspect';
}

/**
 * The Studio: one skeleton for everything.
 *
 * Header, strip, body — in that order, at that shape, whatever is selected and whichever surface
 * is showing. Settings live behind the gear rather than beside Inspect because preferences are
 * about the application, not about the object in front of you; putting them in the same row of
 * tabs is what made the panel feel like three different panels.
 */
export function Inspector(props: InspectorProps) {
  const [section, setSection] = useState<PreferenceSection>('canvas');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const width = clampPanelWidth(props.preferences.panel.width, STUDIO_BOUNDS, 340);
  const inspection = describeSelection(props);
  const tab = objectTab(props.tab);

  const header = settingsOpen
    ? { kind: 'Settings', title: 'Preferences', meta: preferenceSectionMeta(section) }
    : { kind: inspection.kind, title: inspection.title, meta: inspection.meta };

  return (
    <PanelShell label="Studio" side="right" width={width}>
      <PanelHeader
        actions={(
          <>
            {!settingsOpen && props.selection && (
              <IconButton glyph="✕" label="Clear selection" onClick={props.clearSelection} />
            )}
            <IconButton
              glyph="⚙"
              label={settingsOpen ? 'Close preferences' : 'Preferences'}
              onClick={() => setSettingsOpen((open) => !open)}
              pressed={settingsOpen}
            />
          </>
        )}
        kind={header.kind}
        meta={header.meta}
        title={header.title}
      />
      {settingsOpen ? (
        <TabStrip active={section} label="Preference sections" onSelect={setSection} tabs={PREFERENCE_SECTIONS} />
      ) : (
        <TabStrip active={tab} label="Studio surfaces" onSelect={props.setTab} tabs={OBJECT_TABS} />
      )}
      <PanelBody>
        {settingsOpen && (
          <PreferenceControls preferences={props.preferences} section={section} update={props.updatePreferences} />
        )}
        {!settingsOpen && tab === 'inspect' && inspection.body}
        {!settingsOpen && tab === 'json' && <JsonPanel record={props.record} />}
      </PanelBody>
    </PanelShell>
  );
}
