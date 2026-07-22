import type { CanvasPreferences, PreferenceSection } from '../../domain/model';
import { Field, Toggle } from './field';

interface PreferencesPanelProps {
  preferences: CanvasPreferences;
  section: PreferenceSection;
  setSection: (section: PreferenceSection) => void;
  update: (preferences: CanvasPreferences) => void;
}

type Patch = <K extends keyof CanvasPreferences>(key: K, value: CanvasPreferences[K]) => void;
const sections: PreferenceSection[] = ['theme', 'canvas', 'nodes', 'wires', 'panel', 'files'];

function ThemeControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Field label="Theme">
      <select value={value.appearance.theme} onChange={(event) => patch('appearance', { ...value.appearance, theme: event.target.value as CanvasPreferences['appearance']['theme'] })}>
        <option value="dark">Dark</option><option value="light">Light</option>
      </select>
    </Field>
    <Field label="Accent">
      <select value={value.appearance.accent} onChange={(event) => patch('appearance', { ...value.appearance, accent: event.target.value as CanvasPreferences['appearance']['accent'] })}>
        <option value="gold">Gold</option><option value="sage">Sage</option><option value="slate">Slate</option>
      </select>
    </Field>
    <Field label={`Radius · ${value.appearance.radius}`}>
      <input min="0" max="16" type="range" value={value.appearance.radius} onChange={(event) => patch('appearance', { ...value.appearance, radius: Number(event.target.value) })} />
    </Field>
  </>;
}

function CanvasControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Toggle label="Grid" checked={value.canvas.showGrid} onChange={(showGrid) => patch('canvas', { ...value.canvas, showGrid })} />
    <Toggle label="Snap" checked={value.canvas.snapToGrid} onChange={(snapToGrid) => patch('canvas', { ...value.canvas, snapToGrid })} />
    <Toggle label="Controls" checked={value.canvas.showControls} onChange={(showControls) => patch('canvas', { ...value.canvas, showControls })} />
    <Toggle label="Legend" checked={value.canvas.showLegend} onChange={(showLegend) => patch('canvas', { ...value.canvas, showLegend })} />
    <Field label={`Grid size · ${value.canvas.gridSize}`}>
      <input min="4" max="32" type="range" value={value.canvas.gridSize} onChange={(event) => patch('canvas', { ...value.canvas, gridSize: Number(event.target.value) })} />
    </Field>
  </>;
}

function NodeControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Toggle label="Object kinds" checked={value.nodes.showKinds} onChange={(showKinds) => patch('nodes', { ...value.nodes, showKinds })} />
    <Toggle label="Descriptions" checked={value.nodes.showDescriptions} onChange={(showDescriptions) => patch('nodes', { ...value.nodes, showDescriptions })} />
    <Toggle label="Types" checked={value.nodes.showTypes} onChange={(showTypes) => patch('nodes', { ...value.nodes, showTypes })} />
    <Field label="Interfaces">
      <select value={value.nodes.showInterfaces} onChange={(event) => patch('nodes', { ...value.nodes, showInterfaces: event.target.value as CanvasPreferences['nodes']['showInterfaces'] })}>
        <option value="always">Always</option><option value="selected">Selected</option><option value="never">Never</option>
      </select>
    </Field>
    <Field label="Ports">
      <select value={value.nodes.showPorts} onChange={(event) => patch('nodes', { ...value.nodes, showPorts: event.target.value as CanvasPreferences['nodes']['showPorts'] })}>
        <option value="hover">Hover</option><option value="always">Always</option>
      </select>
    </Field>
  </>;
}

function WireControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Toggle label="Dim unrelated" checked={value.wires.dimUnrelated} onChange={(dimUnrelated) => patch('wires', { ...value.wires, dimUnrelated })} />
    <Field label="Labels">
      <select value={value.wires.showLabels} onChange={(event) => patch('wires', { ...value.wires, showLabels: event.target.value as CanvasPreferences['wires']['showLabels'] })}>
        <option value="selected">Selected</option><option value="always">Always</option><option value="never">Never</option>
      </select>
    </Field>
    <Field label={`Width · ${value.wires.width}`}>
      <input min="1" max="4" step="0.25" type="range" value={value.wires.width} onChange={(event) => patch('wires', { ...value.wires, width: Number(event.target.value) })} />
    </Field>
  </>;
}

function PanelControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Field label={`Width · ${value.panel.width}`}>
      <input min="300" max="560" type="range" value={value.panel.width} onChange={(event) => patch('panel', { ...value.panel, width: Number(event.target.value) })} />
    </Field>
    <Toggle label="Empty fields" checked={value.panel.showEmptyFields} onChange={(showEmptyFields) => patch('panel', { ...value.panel, showEmptyFields })} />
  </>;
}

function FileControls({ value, patch }: { value: CanvasPreferences; patch: Patch }) {
  return <>
    <Toggle label="Auto-save" checked={value.files.autoSave} onChange={(autoSave) => patch('files', { ...value.files, autoSave })} />
    <Field label={`Delay · ${value.files.saveDelay}ms`}>
      <input min="100" max="2000" step="100" type="range" value={value.files.saveDelay} onChange={(event) => patch('files', { ...value.files, saveDelay: Number(event.target.value) })} />
    </Field>
  </>;
}

function SectionControls({ section, value, patch }: { section: PreferenceSection; value: CanvasPreferences; patch: Patch }) {
  if (section === 'theme') return <ThemeControls value={value} patch={patch} />;
  if (section === 'canvas') return <CanvasControls value={value} patch={patch} />;
  if (section === 'nodes') return <NodeControls value={value} patch={patch} />;
  if (section === 'wires') return <WireControls value={value} patch={patch} />;
  if (section === 'panel') return <PanelControls value={value} patch={patch} />;
  return <FileControls value={value} patch={patch} />;
}

/** Presents one compact preference category at a time. */
export function PreferencesPanel({ preferences, section, setSection, update }: PreferencesPanelProps) {
  const patch: Patch = (key, value) => update({ ...preferences, [key]: value });
  return (
    <div className="preferences-panel">
      <nav className="preference-sections">
        {sections.map((item) => (
          <button className={item === section ? 'is-active' : ''} key={item} onClick={() => setSection(item)} type="button">{item}</button>
        ))}
      </nav>
      <div className="preference-controls"><SectionControls section={section} value={preferences} patch={patch} /></div>
    </div>
  );
}
