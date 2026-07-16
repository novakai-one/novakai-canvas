import type { CanvasPreferences, PreferenceSection } from '../../domain/model';
import { Field, Toggle } from './field';

interface PreferencesPanelProps {
  preferences: CanvasPreferences;
  section: PreferenceSection;
  setSection: (section: PreferenceSection) => void;
  update: (preferences: CanvasPreferences) => void;
}

const sections: PreferenceSection[] = ['canvas', 'nodes', 'wires', 'panel', 'files'];

export function PreferencesPanel({ preferences, section, setSection, update }: PreferencesPanelProps) {
  const patch = <K extends keyof CanvasPreferences>(key: K, value: CanvasPreferences[K]): void => {
    update({ ...preferences, [key]: value });
  };
  return (
    <div className="preferences-panel">
      <nav className="preference-sections">
        {sections.map((item) => (
          <button className={item === section ? 'is-active' : ''} key={item} onClick={() => setSection(item)} type="button">
            {item}
          </button>
        ))}
      </nav>
      <div className="preference-controls">
        {section === 'canvas' && <>
          <Toggle label="Grid" checked={preferences.canvas.showGrid} onChange={(showGrid) => patch('canvas', { ...preferences.canvas, showGrid })} />
          <Toggle label="Snap" checked={preferences.canvas.snapToGrid} onChange={(snapToGrid) => patch('canvas', { ...preferences.canvas, snapToGrid })} />
          <Toggle label="Controls" checked={preferences.canvas.showControls} onChange={(showControls) => patch('canvas', { ...preferences.canvas, showControls })} />
          <Field label={`Grid size · ${preferences.canvas.gridSize}`}>
            <input min="4" max="32" type="range" value={preferences.canvas.gridSize} onChange={(event) => patch('canvas', { ...preferences.canvas, gridSize: Number(event.target.value) })} />
          </Field>
        </>}
        {section === 'nodes' && <>
          <Toggle label="Object kinds" checked={preferences.nodes.showKinds} onChange={(showKinds) => patch('nodes', { ...preferences.nodes, showKinds })} />
          <Toggle label="Descriptions" checked={preferences.nodes.showDescriptions} onChange={(showDescriptions) => patch('nodes', { ...preferences.nodes, showDescriptions })} />
          <Toggle label="Types" checked={preferences.nodes.showTypes} onChange={(showTypes) => patch('nodes', { ...preferences.nodes, showTypes })} />
          <Field label="Interfaces">
            <select value={preferences.nodes.showInterfaces} onChange={(event) => patch('nodes', { ...preferences.nodes, showInterfaces: event.target.value as CanvasPreferences['nodes']['showInterfaces'] })}>
              <option value="always">Always</option><option value="selected">Selected</option><option value="never">Never</option>
            </select>
          </Field>
          <Field label="Ports">
            <select value={preferences.nodes.showPorts} onChange={(event) => patch('nodes', { ...preferences.nodes, showPorts: event.target.value as CanvasPreferences['nodes']['showPorts'] })}>
              <option value="hover">Hover</option><option value="always">Always</option>
            </select>
          </Field>
        </>}
        {section === 'wires' && <>
          <Toggle label="Dim unrelated" checked={preferences.wires.dimUnrelated} onChange={(dimUnrelated) => patch('wires', { ...preferences.wires, dimUnrelated })} />
          <Field label="Labels">
            <select value={preferences.wires.showLabels} onChange={(event) => patch('wires', { ...preferences.wires, showLabels: event.target.value as CanvasPreferences['wires']['showLabels'] })}>
              <option value="selected">Selected</option><option value="always">Always</option><option value="never">Never</option>
            </select>
          </Field>
          <Field label={`Width · ${preferences.wires.width}`}>
            <input min="1" max="4" step="0.25" type="range" value={preferences.wires.width} onChange={(event) => patch('wires', { ...preferences.wires, width: Number(event.target.value) })} />
          </Field>
        </>}
        {section === 'panel' && <>
          <Field label={`Width · ${preferences.panel.width}`}>
            <input min="300" max="560" type="range" value={preferences.panel.width} onChange={(event) => patch('panel', { ...preferences.panel, width: Number(event.target.value) })} />
          </Field>
          <Toggle label="Empty fields" checked={preferences.panel.showEmptyFields} onChange={(showEmptyFields) => patch('panel', { ...preferences.panel, showEmptyFields })} />
        </>}
        {section === 'files' && <>
          <Toggle label="Auto-save" checked={preferences.files.autoSave} onChange={(autoSave) => patch('files', { ...preferences.files, autoSave })} />
          <Field label={`Delay · ${preferences.files.saveDelay}ms`}>
            <input min="100" max="2000" step="100" type="range" value={preferences.files.saveDelay} onChange={(event) => patch('files', { ...preferences.files, saveDelay: Number(event.target.value) })} />
          </Field>
        </>}
      </div>
    </div>
  );
}
