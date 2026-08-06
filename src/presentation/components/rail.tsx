import { useState } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import {
  PanelBand, PanelBody, PanelFooter, PanelHeader, PanelSection, PanelShell, RAIL_BOUNDS,
  RailAction, RailRow, clampPanelWidth,
} from '../shell';
import { findObjects, groupDiagrams } from './rail-filter';

/** What the rail needs from the library, and the three things it can ask of it. */
export interface RailProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  /** Travel: opens the diagram. The rail is the only chrome that moves you between them. */
  changeDiagram: (diagramId: string) => void;
  createDiagram: () => void;
  /** Travel to one object a search named: opens its diagram and lands on it. */
  openAtObject: (diagramId: string, label: string) => void;
  /** Most-recently-opened first, this sitting only — a property of the session, not the record. */
  recentDiagramIds: readonly string[];
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
  width: number;
  collapsed: boolean;
  setWidth: (width: number) => void;
}

function RailList({
  diagrams, onStatus, onTravel, activeDiagramId, statusAction, statusGlyph, statusLabel,
}: {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  onTravel: (id: string) => void;
  onStatus: (id: string, status: 'active' | 'archived') => void;
  statusAction: 'active' | 'archived';
  statusGlyph: string;
  statusLabel: string;
}) {
  return (
    <ul className="rail-rows">
      {diagrams.map((entry) => (
        <RailRow
          action={(
            <RailAction
              glyph={statusGlyph}
              label={`${statusLabel} ${entry.name}`}
              onClick={() => onStatus(entry.id, statusAction)}
            />
          )}
          active={entry.id === activeDiagramId}
          key={entry.id}
          label={entry.name}
          onTravel={() => onTravel(entry.id)}
        />
      ))}
    </ul>
  );
}

/**
 * The left rail: where you are, and everywhere you could be instead.
 *
 * It replaces a dropdown and a search box that lived in a floating toolbar. A list organised by
 * meaning, with counts and one lit row, answers "where am I" without being asked — which a
 * collapsed `<select>` never could.
 */
export function Rail(props: RailProps) {
  const [query, setQuery] = useState('');
  const groups = groupDiagrams(props.diagrams, query, props.activeDiagramId);
  const objects = findObjects(props.diagrams, query);
  // Recent is only worth its space when there is a list long enough to get lost in, and only
  // while nothing is being searched — a search already IS the shortcut.
  const recent = query.trim().length > 0 ? [] : props.recentDiagramIds
    .map((id) => groups.active.find((entry) => entry.id === id))
    .filter((entry): entry is DiagramSummary => Boolean(entry))
    .slice(0, 5);
  const total = props.diagrams.filter((entry) => entry.status === 'active').length;
  const archived = props.diagrams.length - total;
  const width = clampPanelWidth(props.width, RAIL_BOUNDS, 264);

  return (
    <PanelShell
      bounds={RAIL_BOUNDS}
      collapsed={props.collapsed}
      label="Diagrams"
      onResize={props.setWidth}
      side="left"
      width={width}
    >
      <PanelHeader
        kind=">_ novakai"
        meta={`${total} diagrams${archived > 0 ? ` · ${archived} archived` : ''}`}
        title="Canvas"
      />
      <PanelBand>
        <input
          aria-label="Search diagrams and objects"
          className="rail-filter"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search diagrams and objects"
          type="search"
          value={query}
        />
      </PanelBand>
      <PanelBody>
        {/*
          * The objects a search found, above the diagrams that contain them.
          * A search whose only answer is "these documents somewhere" is the filter Chris
          * was complaining about; the match itself is the answer.
          */}
        {objects.total > 0 && (
          <PanelSection
            title="Objects"
            trailing={<span className="rail-count">{objects.total}</span>}
          >
            <ul className="rail-rows">
              {objects.hits.map((hit) => (
                <li className="rail-hit" key={`${hit.diagramId}:${hit.label}`}>
                  <button
                    className="rail-travel"
                    onClick={() => props.openAtObject(hit.diagramId, hit.label)}
                    type="button"
                  >
                    <span className="rail-hit-label">{hit.label}</span>
                    <span className="rail-hit-where">{hit.diagramName}</span>
                  </button>
                </li>
              ))}
            </ul>
            {objects.total > objects.hits.length && (
              <div className="rail-more">{objects.total - objects.hits.length} more — keep typing</div>
            )}
          </PanelSection>
        )}
        {recent.length > 1 && groups.active.length > 8 && (
          <PanelSection title="Recent" trailing={<span className="rail-count">{recent.length}</span>}>
            <RailList
              activeDiagramId={props.activeDiagramId}
              diagrams={recent}
              onStatus={props.setDiagramStatus}
              onTravel={props.changeDiagram}
              statusAction="archived"
              statusGlyph="↓"
              statusLabel="Archive"
            />
          </PanelSection>
        )}
        <PanelSection title="All diagrams" trailing={<span className="rail-count">{groups.active.length}</span>}>
          {groups.active.length === 0
            ? <div className="panel-empty"><span>No match</span></div>
            : (
              <RailList
                activeDiagramId={props.activeDiagramId}
                diagrams={groups.active}
                onStatus={props.setDiagramStatus}
                onTravel={props.changeDiagram}
                statusAction="archived"
                statusGlyph="↓"
                statusLabel="Archive"
              />
            )}
        </PanelSection>
        {groups.archived.length > 0 && (
          <PanelSection title="Archived" trailing={<span className="rail-count">{groups.archived.length}</span>}>
            <RailList
              activeDiagramId={props.activeDiagramId}
              diagrams={groups.archived}
              onStatus={props.setDiagramStatus}
              onTravel={props.changeDiagram}
              statusAction="active"
              statusGlyph="↑"
              statusLabel="Restore"
            />
          </PanelSection>
        )}
      </PanelBody>
      <PanelFooter>
        <button className="panel-button" onClick={props.createDiagram} type="button">+ New diagram</button>
      </PanelFooter>
    </PanelShell>
  );
}
