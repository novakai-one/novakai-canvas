import type { CanvasSurfaceProps } from './canvas-surface';


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
 * What is left over the canvas: how you are working, and whether it is saved.
 *
 * Choosing a diagram and searching for one belong to the rail — they are navigation, and
 * navigation has a home now. What stays here is only what is about the canvas itself.
 */
export function CanvasToolbar({ props }: { props: CanvasSurfaceProps }) {
  return (
    <div className="canvas-toolbar">
      <ModeSwitch props={props} />
      {props.canGoBack && <button onClick={props.goBack} type="button">← Back</button>}
      {props.mode === 'edit' && (
        <span
          className="save-status"
          data-state={props.saveStatus === 'Saved' || props.saveStatus === 'Saving' ? 'clean' : 'unsaved'}
          role="status"
        >
          {props.saveStatus}
        </span>
      )}
    </div>
  );
}
