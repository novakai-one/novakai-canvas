import { useEffect } from 'react';
import type { Selection } from '../../domain/model';
import type { DiagramRecord } from '../../domain/records';
import { escapeStep, selectionResolves } from '../canvas-actions';

/** True while the keystroke belongs to a field the user is typing in, not to the canvas. */
function typingInAField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function useEscapeStepsOutward(
  active: boolean,
  record: DiagramRecord,
  selection: Selection,
  setSelection: (selection: Selection) => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || typingInAField(event.target) || !selection) return;
      event.preventDefault();
      setSelection(escapeStep(record, selection));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, record, selection, setSelection]);
}

function useUndoShortcut(active: boolean, canUndo: boolean, undo: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (key !== 'z' || !(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || typingInAField(event.target)) return;
      event.preventDefault();
      if (canUndo) undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, canUndo, undo]);
}

function useSelectionReleasesWithItsObject(
  record: DiagramRecord,
  selection: Selection,
  setSelection: (selection: Selection) => void,
): void {
  useEffect(() => {
    if (!selectionResolves(record, selection)) setSelection(null);
  }, [record, selection, setSelection]);
}

/** Canvas-owned keyboard and selection-lifetime behaviour. */
export function useCanvasShortcuts(options: {
  active: boolean;
  escapeActive: boolean;
  canUndo: boolean;
  record: DiagramRecord;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  undo: () => void;
}): void {
  useEscapeStepsOutward(
    options.escapeActive, options.record, options.selection, options.setSelection,
  );
  useUndoShortcut(options.active, options.canUndo, options.undo);
  useSelectionReleasesWithItsObject(options.record, options.selection, options.setSelection);
}
