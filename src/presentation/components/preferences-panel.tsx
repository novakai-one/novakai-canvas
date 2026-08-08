import type { CanvasPreferences, PreferenceSection } from '../../domain/model';
import { WIRE_LABEL_SIZE_LIMITS } from '../../domain/wire-label-size';
import { FieldRow, PanelSection, SwitchRow, TARGET_SIZES, targetScale } from '../shell';
import { WIRE_SHAPES, WIRE_SHAPE_HINTS } from '../edges/wire-shape';

type Patch = <K extends keyof CanvasPreferences>(key: K, value: CanvasPreferences[K]) => void;

function ThemeControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  return (
    <PanelSection title="Appearance">
      <FieldRow label="Theme">
        <select onChange={(event) => patch('appearance', { ...value.appearance, theme: event.target.value as CanvasPreferences['appearance']['theme'] })} value={value.appearance.theme}>
          <option value="dark">Dark</option><option value="light">Light</option>
        </select>
      </FieldRow>
      <FieldRow label="Accent">
        <select onChange={(event) => patch('appearance', { ...value.appearance, accent: event.target.value as CanvasPreferences['appearance']['accent'] })} value={value.appearance.accent}>
          <option value="gold">Gold</option><option value="sage">Sage</option><option value="slate">Slate</option>
        </select>
      </FieldRow>
      <FieldRow hint={`${value.appearance.radius}px`} label="Corner radius">
        <input max="16" min="0" onChange={(event) => patch('appearance', { ...value.appearance, radius: Number(event.target.value) })} type="range" value={value.appearance.radius} />
      </FieldRow>
      {/*
        * Breathing room and type size, as two numbers rather than one taste.
        * "Roomier" and "bigger words" are different complaints, so they get different knobs.
        */}
      <FieldRow label="Density">
        <select onChange={(event) => patch('appearance', { ...value.appearance, density: event.target.value as CanvasPreferences['appearance']['density'] })} value={value.appearance.density}>
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="roomy">Roomy</option>
        </select>
      </FieldRow>
      <FieldRow hint={`${Math.round((value.appearance.textScale ?? 1) * 100)}%`} label="Text size">
        <input max="1.35" min="0.85" onChange={(event) => patch('appearance', { ...value.appearance, textScale: Number(event.target.value) })} step="0.05" type="range" value={value.appearance.textScale ?? 1} />
      </FieldRow>
    </PanelSection>
  );
}

function CanvasControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  return (
    <>
      <PanelSection title="Show">
        <SwitchRow checked={value.canvas.showGrid} label="Grid" onChange={(showGrid) => patch('canvas', { ...value.canvas, showGrid })} />
        <SwitchRow checked={value.canvas.snapToGrid} label="Snap to grid" onChange={(snapToGrid) => patch('canvas', { ...value.canvas, snapToGrid })} />
        <SwitchRow checked={value.canvas.showControls} label="Zoom controls" onChange={(showControls) => patch('canvas', { ...value.canvas, showControls })} />
        <SwitchRow checked={value.canvas.showLegend} label="Legend" onChange={(showLegend) => patch('canvas', { ...value.canvas, showLegend })} />
      </PanelSection>
      <PanelSection title="Measure">
        <FieldRow hint={`${value.canvas.gridSize}px`} label="Grid size">
          <input max="32" min="4" onChange={(event) => patch('canvas', { ...value.canvas, gridSize: Number(event.target.value) })} type="range" value={value.canvas.gridSize} />
        </FieldRow>
        <FieldRow hint={`${value.canvas.groupPadding}px`} label="Group breathing room">
          <input max="160" min="16" onChange={(event) => patch('canvas', { ...value.canvas, groupPadding: Number(event.target.value) })} step="8" type="range" value={value.canvas.groupPadding} />
        </FieldRow>
        {/* How big the things you have to hit are: ports, resize corners, wire ends. */}
        <FieldRow
          hint={`${targetScale(value.canvas.targetSize ?? 'medium').dot}px dots`}
          label="Control size"
        >
          <select onChange={(event) => patch('canvas', { ...value.canvas, targetSize: event.target.value as CanvasPreferences['canvas']['targetSize'] })} value={value.canvas.targetSize ?? 'medium'}>
            {TARGET_SIZES.map((size) => (
              <option key={size} value={size}>{size[0].toUpperCase()}{size.slice(1)}</option>
            ))}
          </select>
        </FieldRow>
      </PanelSection>
    </>
  );
}

function NodeControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  return (
    <>
      <PanelSection title="Show">
        <SwitchRow checked={value.nodes.showKinds} label="Object kinds" onChange={(showKinds) => patch('nodes', { ...value.nodes, showKinds })} />
        <SwitchRow checked={value.nodes.showDescriptions} label="Descriptions" onChange={(showDescriptions) => patch('nodes', { ...value.nodes, showDescriptions })} />
        <SwitchRow checked={value.nodes.showTypes} label="Types" onChange={(showTypes) => patch('nodes', { ...value.nodes, showTypes })} />
      </PanelSection>
      <PanelSection title="Detail">
        <FieldRow label="Interfaces">
          <select onChange={(event) => patch('nodes', { ...value.nodes, showInterfaces: event.target.value as CanvasPreferences['nodes']['showInterfaces'] })} value={value.nodes.showInterfaces}>
            <option value="always">Always</option><option value="selected">When selected</option><option value="never">Never</option>
          </select>
        </FieldRow>
        <FieldRow label="Ports">
          <select onChange={(event) => patch('nodes', { ...value.nodes, showPorts: event.target.value as CanvasPreferences['nodes']['showPorts'] })} value={value.nodes.showPorts}>
            <option value="hover">On hover</option><option value="always">Always</option>
          </select>
        </FieldRow>
      </PanelSection>
    </>
  );
}

function WireControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  const maxLabelSize = value.wires.maxLabelSize ?? WIRE_LABEL_SIZE_LIMITS.defaultMaximum;
  return (
    <PanelSection title="Drawing">
      <SwitchRow checked={value.wires.dimUnrelated} label="Dim unrelated" onChange={(dimUnrelated) => patch('wires', { ...value.wires, dimUnrelated })} />
      <FieldRow label="Labels">
        <select onChange={(event) => patch('wires', { ...value.wires, showLabels: event.target.value as CanvasPreferences['wires']['showLabels'] })} value={value.wires.showLabels}>
          <option value="selected">When selected</option><option value="always">Always</option><option value="never">Never</option>
        </select>
      </FieldRow>
      <FieldRow hint={`${value.wires.width}px`} label="Width">
        <input max="4" min="1" onChange={(event) => patch('wires', { ...value.wires, width: Number(event.target.value) })} step="0.25" type="range" value={value.wires.width} />
      </FieldRow>
      {/* Shape is a look, not a route: every value draws the points the router already chose. */}
      <FieldRow hint={WIRE_SHAPE_HINTS[value.wires.shape ?? 'elbow']} label="Shape">
        <select onChange={(event) => patch('wires', { ...value.wires, shape: event.target.value as CanvasPreferences['wires']['shape'] })} value={value.wires.shape ?? 'elbow'}>
          {WIRE_SHAPES.map((shape) => (
            <option key={shape} value={shape}>{shape[0].toUpperCase()}{shape.slice(1)}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow hint={`${Math.round((value.wires.labelScale ?? 1) * 100)}%`} label="Label size">
        <input max="1.5" min="0.85" onChange={(event) => patch('wires', { ...value.wires, labelScale: Number(event.target.value) })} step="0.05" type="range" value={value.wires.labelScale ?? 1} />
      </FieldRow>
      <FieldRow hint={`${maxLabelSize}px`} label="Maximum label size">
        <input
          max={WIRE_LABEL_SIZE_LIMITS.maximum}
          min={WIRE_LABEL_SIZE_LIMITS.minimum}
          onChange={(event) => patch('wires', { ...value.wires, maxLabelSize: Number(event.target.value) })}
          step="1"
          type="range"
          value={maxLabelSize}
        />
      </FieldRow>
      <SwitchRow
        checked={value.wires.avoidNodes ?? true}
        label="Route around nodes"
        onChange={(avoidNodes) => patch('wires', { ...value.wires, avoidNodes })}
      />
    </PanelSection>
  );
}

function PanelControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  return (
    <PanelSection title="Studio">
      <FieldRow hint={`${value.panel.width}px`} label="Width">
        <input max="520" min="280" onChange={(event) => patch('panel', { ...value.panel, width: Number(event.target.value) })} type="range" value={value.panel.width} />
      </FieldRow>
      <SwitchRow checked={value.panel.showEmptyFields} label="Empty fields" onChange={(showEmptyFields) => patch('panel', { ...value.panel, showEmptyFields })} />
      {/*
        * One section open at a time is what bounds how much a panel can show. `all-open` is the
        * old everything-at-once, kept because it is a preference rather than an argument.
        */}
      <FieldRow label="Sections">
        <select onChange={(event) => patch('panel', { ...value.panel, sections: event.target.value as CanvasPreferences['panel']['sections'] })} value={value.panel.sections ?? 'accordion'}>
          <option value="accordion">One at a time</option>
          <option value="all-open">All open</option>
        </select>
      </FieldRow>
      <FieldRow label="Left panel opens on">
        <select onChange={(event) => patch('panel', { ...value.panel, leftDefaultTab: event.target.value as CanvasPreferences['panel']['leftDefaultTab'] })} value={value.panel.leftDefaultTab ?? 'build'}>
          <option value="build">Build</option>
          <option value="contents">Contents</option>
        </select>
      </FieldRow>
      <SwitchRow
        checked={value.panel.showDividers ?? true}
        label="Section rules"
        onChange={(showDividers) => patch('panel', { ...value.panel, showDividers })}
      />
      <SwitchRow
        checked={value.panel.reframeOnPanelMove ?? false}
        label="Re-frame when panels move"
        onChange={(reframeOnPanelMove) => patch('panel', { ...value.panel, reframeOnPanelMove })}
      />
    </PanelSection>
  );
}

function FileControls({ patch, value }: { value: CanvasPreferences; patch: Patch }) {
  return (
    <PanelSection title="Saving">
      <SwitchRow checked={value.files.autoSave} label="Auto-save" onChange={(autoSave) => patch('files', { ...value.files, autoSave })} />
      <FieldRow hint={`${value.files.saveDelay}ms`} label="Delay">
        <input max="2000" min="100" onChange={(event) => patch('files', { ...value.files, saveDelay: Number(event.target.value) })} step="100" type="range" value={value.files.saveDelay} />
      </FieldRow>
    </PanelSection>
  );
}

/**
 * The body of one preference category.
 *
 * It draws sections only — the header and the section strip belong to the Studio skeleton, so
 * settings look structurally identical to inspecting an object.
 */
export function PreferenceControls({
  preferences, section, update,
}: {
  preferences: CanvasPreferences;
  section: PreferenceSection;
  update: (preferences: CanvasPreferences) => void;
}) {
  const patch: Patch = (key, value) => update({ ...preferences, [key]: value });
  if (section === 'theme') return <ThemeControls patch={patch} value={preferences} />;
  if (section === 'canvas') return <CanvasControls patch={patch} value={preferences} />;
  if (section === 'nodes') return <NodeControls patch={patch} value={preferences} />;
  if (section === 'wires') return <WireControls patch={patch} value={preferences} />;
  if (section === 'panel') return <PanelControls patch={patch} value={preferences} />;
  return <FileControls patch={patch} value={preferences} />;
}
