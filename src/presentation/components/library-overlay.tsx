import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DiagramSummary } from '../../application/canvas-library';
import { PanelSection, oneLine, useCanvasPortalTarget } from '../shell';
import { findObjects, groupDiagrams } from './rail-filter';

/** What the overlay needs to answer "which diagram, or which object in which diagram". */
export interface LibraryOverlayProps {
  diagrams: DiagramSummary[];
  activeDiagramId: string;
  /** Where the row that opened it sits, in viewport coordinates. */
  at: { top: number; left: number };
  close: () => void;
  changeDiagram: (diagramId: string) => void;
  openAtObject: (diagramId: string, label: string) => void;
  createDiagram: () => void;
  setDiagramStatus: (diagramId: string, status: 'active' | 'archived') => void;
}

/**
 * The library, summoned.
 *
 * Choosing a diagram is something you do once and then not again for an hour, so it does not
 * get to hold a column of the screen for that hour. It opens from the diagram's own name, it
 * answers the question, and it goes away — which is also why the search lives here rather than
 * in the rail: a permanent search box over nineteen rows was answering a question nobody had
 * asked yet.
 *
 * Object results are truncated to one line. Comment bodies are node labels too, and rendering
 * a four-line paragraph as a navigation row is exactly the overstimulation this panel exists
 * to remove.
 */
export function LibraryOverlay(props: LibraryOverlayProps) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const portalTarget = useCanvasPortalTarget();

  useEffect(() => {
    if (portalTarget) field.current?.focus();
  }, [portalTarget]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) props.close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // The canvas also listens for Escape to step the selection outward; this one is nearer
      // the user's intention, so it stops here.
      event.stopPropagation();
      props.close();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [props]);

  const groups = groupDiagrams(props.diagrams, query, props.activeDiagramId);
  const objects = findObjects(props.diagrams, query);
  if (!portalTarget) return null;

  /*
   * Drawn outside the rail.
   *
   * The overlay is wider than the panel that summons it, and `.panel-shell` clips its own
   * overflow — rendered inside, it pushed the panel's contents sideways and half of it left the
   * screen. Fixed position against the switcher's rect keeps it attached to the row that opened
   * it without being subject to that row's box.
   */
  return createPortal(
    <div
      aria-label="Diagram library"
      className="library-overlay"
      ref={root}
      role="dialog"
      style={{ top: props.at.top, left: props.at.left }}
    >
      <div className="library-search">
        <input
          aria-label="Search diagrams and objects"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search diagrams and objects"
          ref={field}
          type="search"
          value={query}
        />
      </div>
      <div className="library-body">
        {objects.total > 0 && (
          <PanelSection title="Objects" trailing={<span className="rail-count">{objects.total}</span>}>
            <ul className="library-rows">
              {objects.hits.map((hit) => (
                <li key={`${hit.diagramId}:${hit.label}`}>
                  <button
                    onClick={() => { props.openAtObject(hit.diagramId, hit.label); props.close(); }}
                    type="button"
                  >
                    <span className="library-row-label">{oneLine(hit.label)}</span>
                    <span className="library-row-where">{hit.diagramName}</span>
                  </button>
                </li>
              ))}
            </ul>
            {objects.total > objects.hits.length && (
              <div className="library-more">{objects.total - objects.hits.length} more — keep typing</div>
            )}
          </PanelSection>
        )}
        <PanelSection title="Diagrams" trailing={<span className="rail-count">{groups.active.length}</span>}>
          {groups.active.length === 0
            ? <div className="panel-empty"><span>No match</span></div>
            : (
              <ul className="library-rows">
                {groups.active.map((entry) => (
                  <li data-active={entry.id === props.activeDiagramId || undefined} key={entry.id}>
                    <button
                      onClick={() => { props.changeDiagram(entry.id); props.close(); }}
                      type="button"
                    >
                      <span className="library-row-label">{entry.name}</span>
                    </button>
                    <button
                      aria-label={`Archive ${entry.name}`}
                      className="library-row-action"
                      onClick={() => props.setDiagramStatus(entry.id, 'archived')}
                      title={`Archive ${entry.name}`}
                      type="button"
                    >
                      <span aria-hidden>↓</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </PanelSection>
        {groups.archived.length > 0 && showArchived && (
          <PanelSection title="Archived" trailing={<span className="rail-count">{groups.archived.length}</span>}>
            <ul className="library-rows">
              {groups.archived.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => { props.changeDiagram(entry.id); props.close(); }}
                    type="button"
                  >
                    <span className="library-row-label">{entry.name}</span>
                  </button>
                  <button
                    aria-label={`Restore ${entry.name}`}
                    className="library-row-action"
                    onClick={() => props.setDiagramStatus(entry.id, 'active')}
                    title={`Restore ${entry.name}`}
                    type="button"
                  >
                    <span aria-hidden>↑</span>
                  </button>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </div>
      <div className="library-footer">
        <button onClick={() => { props.createDiagram(); props.close(); }} type="button">
          + New diagram
        </button>
        {groups.archived.length > 0 && (
          <button
            aria-pressed={showArchived}
            className="library-archived-toggle"
            onClick={() => setShowArchived((value) => !value)}
            type="button"
          >
            Archived {groups.archived.length}
          </button>
        )}
      </div>
    </div>,
    portalTarget,
  );
}
