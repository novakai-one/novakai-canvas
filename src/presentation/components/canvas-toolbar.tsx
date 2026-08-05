import { useEffect, useRef, useState } from 'react';
import {
  createCanvasNode, placedNodes, type CreatableNodeKind, type WorldPoint,
} from '../canvas-actions';
import { ShellControls } from '../shell';
import type { CanvasSurfaceProps } from './canvas-surface';

/** Where the user is looking, in the diagram's own coordinates — the canvas answers this. */
type FocusPoint = () => WorldPoint;

const ADDABLE: readonly CreatableNodeKind[] = ['module', 'object', 'runtime', 'resource', 'group', 'comment'];

function ModeSwitch({ props }: { props: CanvasSurfaceProps }) {
  return (
    <div className="mode-switch" aria-label="Canvas mode">
      {(['present', 'edit'] as const).map((mode) => (
        <button className={props.mode === mode ? 'is-active' : ''} key={mode} onClick={() => props.changeMode(mode)} type="button">
          {mode === 'present' ? 'Present' : 'Edit'}
        </button>
      ))}
    </div>
  );
}

/**
 * Adding an object, as a menu rather than a dropdown.
 *
 * A native `<select>` cannot be styled, renders the operating system's own chrome in the middle
 * of the canvas, and reads as a settings control rather than an action. This is a button and a
 * list — the same job, in this application's own type and spacing.
 */
function AddMenu({ focusPoint, props }: { focusPoint: FocusPoint; props: CanvasSurfaceProps }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && holder.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [open]);

  // A new object appears where the user is looking, in whatever frame that point falls in —
  // never at a fixed coordinate somewhere else in the diagram.
  const add = (kind: CreatableNodeKind): void => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const created = createCanvasNode(placedNodes(props.view), kind, id, focusPoint());
    props.execute({ kind: 'node.add', ...created });
    props.setSelection({ kind: 'node', id: created.node.id });
    setOpen(false);
  };

  return (
    <div className="add-menu" ref={holder}>
      <button aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((shown) => !shown)} type="button">
        ＋ Add
      </button>
      {open && (
        <div className="add-menu-list" role="menu">
          {ADDABLE.map((kind) => (
            <button key={kind} onClick={() => add(kind)} role="menuitem" type="button">
              {kind[0].toUpperCase()}{kind.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What is left over the canvas: how you are working, and whether it is saved.
 *
 * Choosing a diagram and searching for one belong to the rail — they are navigation, and
 * navigation has a home now. What stays here is only what is about the canvas itself.
 */
export function CanvasToolbar({ focusPoint, props }: { focusPoint: FocusPoint; props: CanvasSurfaceProps }) {
  return (
    <div className="canvas-toolbar">
      <ModeSwitch props={props} />
      {props.canGoBack && <button onClick={props.goBack} type="button">← Back</button>}
      {props.mode === 'edit' && (
        <div className="toolbar-actions">
          <button disabled={!props.canUndo} onClick={props.undo} type="button">Undo</button>
          <AddMenu focusPoint={focusPoint} props={props} />
        </div>
      )}
      {props.mode === 'edit' && (
        <span
          className="save-status"
          data-state={props.saveStatus === 'Saved' || props.saveStatus === 'Saving' ? 'clean' : 'unsaved'}
          role="status"
        >
          {props.saveStatus}
        </span>
      )}
      <ShellControls />
    </div>
  );
}
