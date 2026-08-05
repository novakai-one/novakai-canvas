import { useState } from 'react';
import type { DiagramSummary } from '../../application/canvas-library';
import {
  PanelBand, PanelBody, PanelFooter, PanelHeader, PanelSection, PanelShell, RAIL_BOUNDS,
  RailAction, RailRow, clampPanelWidth,
} from '../shell';
import { groupDiagrams } from './rail-filter';

/** What the rail needs from the library, and the three things it can ask of it. */
export interface RailProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  /** Travel: opens the diagram. The rail is the only chrome that moves you between them. */
  changeDiagram: (diagramId: string) => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
  width: number;
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
  const total = props.diagrams.filter((entry) => entry.status === 'active').length;
  const archived = props.diagrams.length - total;
  const width = clampPanelWidth(props.width, RAIL_BOUNDS, 264);

  return (
    <PanelShell label="Diagrams" side="left" width={width}>
      <PanelHeader
        kind="Novakai"
        meta={`${total} diagrams${archived > 0 ? ` · ${archived} archived` : ''}`}
        title="Canvas"
      />
      <PanelBand>
        <input
          aria-label="Filter diagrams"
          className="rail-filter"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter"
          type="search"
          value={query}
        />
      </PanelBand>
      <PanelBody>
        <PanelSection title="Diagrams" trailing={<span className="rail-count">{groups.active.length}</span>}>
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
