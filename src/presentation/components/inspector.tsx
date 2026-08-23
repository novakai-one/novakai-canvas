import { useCallback, useMemo, useState } from 'react';
import type { CanvasPreferences, PreferenceSection } from '../../domain/model';
import type { DiagramExportFormat } from '../../diagram-export/contract';
import {
  Flyout, IconButton, PanelBody, PanelCollapse, PanelHeader, PanelShell, STUDIO_BOUNDS,
  TabStrip, clampPanelWidth, resolveOpenSection,
} from '../shell';
import { describeSelection, type InspectPanelProps } from './inspect-panel';
import { PREFERENCE_SECTIONS, preferenceSectionMeta } from './preference-sections';
import { PreferenceControls } from './preferences-panel';

/** What the Studio inspects, plus the surfaces it can switch between. */
export interface InspectorProps extends Omit<InspectPanelProps, 'isSectionOpen' | 'toggleSection'> {
  preferences: CanvasPreferences;
  updatePreferences: (preferences: CanvasPreferences) => void;
  collapsed: boolean;
  setWidth: (width: number) => void;
  /** Renders and copies one of the three user-facing diagram products. */
  copyDiagram: (format: CopyDiagramFormat) => Promise<boolean>;
  /** Passed to the header: a brand-new diagram's title field wakes up focused, text selected. */
  focusTitle?: boolean;
}

/** How long "Copied" stays on screen before the control goes quiet again. */
const COPIED_MS = 1400;

type CopyDiagramFormat = Exclude<DiagramExportFormat, 'dsl'>;

const COPY_FORMATS = [
  { id: 'agent', label: 'Copy for agent', hint: 'Canonical Canvas DSL in a Markdown fence' },
  { id: 'markdown', label: 'Copy as Markdown', hint: 'Compact objects, members and relationships' },
  { id: 'json', label: 'Copy full JSON', hint: 'Complete persistence record' },
] as const;

/**
 * The Studio: one skeleton for everything.
 *
 * Header, strip, body — in that order, at that shape, whatever is selected and whichever surface
 * is showing. What changed is how much of the body is on screen at once: sections are an
 * accordion, so a selection is one open section plus a short list of headings rather than every
 * fact the record holds, laid out at equal weight.
 *
 * Settings live behind the gear rather than beside Inspect because preferences are about the
 * application, not about the object in front of you.
 */
export function Inspector(props: InspectorProps) {
  const [section, setSection] = useState<PreferenceSection>('canvas');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const width = clampPanelWidth(props.preferences.panel.width, STUDIO_BOUNDS, 340);

  const sectionMode = props.preferences.panel.sections ?? 'accordion';
  // Two passes on purpose: the inspection has to be described before its section list is known,
  // and the list is what decides which of them is open.
  const listing = describeSelection({ ...props, isSectionOpen: () => true, toggleSection: () => {} });
  const isOpen = useMemo(
    () => resolveOpenSection(sectionMode, listing.sections, openSection),
    [listing.sections, openSection, sectionMode],
  );
  const toggleSection = useCallback((id: string) => setOpenSection(id), []);
  const inspection = describeSelection({ ...props, isSectionOpen: isOpen, toggleSection });

  const copy = useCallback((format: CopyDiagramFormat) => {
    void props.copyDiagram(format).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_MS);
    });
  }, [props]);

  const header = settingsOpen
    ? { kind: 'Settings', title: 'Preferences', meta: preferenceSectionMeta(section) }
    : { kind: inspection.kind, title: inspection.title, meta: inspection.meta };

  return (
    <PanelShell
      bounds={STUDIO_BOUNDS}
      collapsed={props.collapsed}
      label="Studio"
      onResize={props.setWidth}
      side="right"
      width={width}
    >
      <PanelHeader
        actions={(
          <>
            {/*
              * Copying the record is a first-class act, not a surface to navigate to.
              *
              * It was a tab called "Json" sitting beside Inspect, so handing a diagram to an
              * agent meant switching surfaces and selecting text. One control, one click, and
              * it says so when it has done it.
              */}
            {!settingsOpen && (
              <Flyout
                items={COPY_FORMATS}
                label={copied ? 'Copied' : 'Copy diagram'}
                onPick={(format) => copy(format as CopyDiagramFormat)}
              >
                <span aria-hidden>{copied ? '✓' : '⧉'}</span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Flyout>
            )}
            {!settingsOpen && inspection.remove && (
              <Flyout
                items={[{ id: 'remove', label: inspection.remove.label }]}
                label="More"
                onPick={() => inspection.remove?.run()}
              >
                <span aria-hidden>⋯</span>
              </Flyout>
            )}
            {!settingsOpen && props.selection && (
              <IconButton glyph="✕" label="Clear selection" onClick={props.clearSelection} />
            )}
            <IconButton
              glyph="⚙"
              label={settingsOpen ? 'Close preferences' : 'Preferences'}
              onClick={() => setSettingsOpen((open) => !open)}
              pressed={settingsOpen}
            />
            <PanelCollapse side="right" />
          </>
        )}
        focusTitle={settingsOpen ? undefined : props.focusTitle}
        kind={header.kind}
        meta={header.meta}
        rename={settingsOpen ? undefined : inspection.rename}
        title={header.title}
        trail={inspection.trail.length > 1 && !settingsOpen && (
          /*
            * The path back. Every step but the last is a link, because the last one is where
            * you already are — clicking it would be a no-op dressed as a way out.
            */
          <nav aria-label="Path back" className="panel-trail">
            {inspection.trail.slice(0, -1).map((step, index) => (
              <span key={`${step.select ? JSON.stringify(step.select) : 'root'}-${index}`}>
                <button onClick={() => props.select(step.select)} type="button">{step.label}</button>
                <span aria-hidden className="panel-trail-sep">›</span>
              </span>
            ))}
          </nav>
        )}
      />
      {settingsOpen && (
        <TabStrip active={section} label="Preference sections" onSelect={setSection} tabs={PREFERENCE_SECTIONS} />
      )}
      <PanelBody>
        {settingsOpen
          ? <PreferenceControls preferences={props.preferences} section={section} update={props.updatePreferences} />
          : inspection.body}
      </PanelBody>
    </PanelShell>
  );
}
