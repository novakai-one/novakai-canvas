import { useState } from 'react';
import type { CanvasPreferences, InspectorTab, PreferenceSection } from '../../domain/model';
import { InspectPanel, type InspectPanelProps } from './inspect-panel';
import { JsonPanel } from './json-panel';
import { PreferencesPanel } from './preferences-panel';

/** What the inspector inspects, plus the surfaces it can switch between. */
export interface InspectorProps extends InspectPanelProps {
  preferences: CanvasPreferences;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  updatePreferences: (preferences: CanvasPreferences) => void;
}

/** Routes universal selection into contextual inspector surfaces. */
export function Inspector(props: InspectorProps) {
  const [section, setSection] = useState<PreferenceSection>('canvas');
  const tabs: InspectorTab[] = props.editable ? ['inspect', 'preferences', 'json'] : ['inspect'];
  return (
    <aside className="inspector" style={{ width: props.preferences.panel.width }}>
      <nav className="inspector-tabs">
        {tabs.map((tab) => (
          <button className={props.tab === tab ? 'is-active' : ''} key={tab} onClick={() => props.setTab(tab)} type="button">{tab}</button>
        ))}
      </nav>
      <div className="inspector-body">
        {(!props.editable || props.tab === 'inspect') && <InspectPanel {...props} />}
        {props.editable && props.tab === 'preferences' && <PreferencesPanel preferences={props.preferences} section={section} setSection={setSection} update={props.updatePreferences} />}
        {props.editable && props.tab === 'json' && <JsonPanel record={props.record} />}
      </div>
    </aside>
  );
}
