import { useState } from 'react';
import type {
  ArchitectureDocument, CanvasCommand, CanvasPreferences, InspectorTab, PreferenceSection, Selection,
} from '../../domain/model';
import { InspectPanel } from './inspect-panel';
import { JsonPanel } from './json-panel';
import { PreferencesPanel } from './preferences-panel';

interface InspectorProps {
  document: ArchitectureDocument;
  visibleDocument: ArchitectureDocument;
  select: (selection: Selection) => void;
  preferences: CanvasPreferences;
  selection: Selection;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  execute: (command: CanvasCommand) => void;
  replace: (document: ArchitectureDocument) => void;
  updatePreferences: (preferences: CanvasPreferences) => void;
  clearSelection: () => void;
  editable: boolean;
  openDiagram: (diagramId: string) => void;
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
        {(!props.editable || props.tab === 'inspect') && <InspectPanel document={props.document} visibleDocument={props.visibleDocument} select={props.select} selection={props.selection} execute={props.execute} clearSelection={props.clearSelection} editable={props.editable} openDiagram={props.openDiagram} />}
        {props.editable && props.tab === 'preferences' && <PreferencesPanel preferences={props.preferences} section={section} setSection={setSection} update={props.updatePreferences} />}
        {props.editable && props.tab === 'json' && <JsonPanel document={props.document} replace={props.replace} />}
      </div>
    </aside>
  );
}
