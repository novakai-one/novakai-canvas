/** Shown instead of the canvas when saved data cannot be read. Nothing is written. */
export function LoadFailure({ detail }: { detail: string }) {
  return (
    <main
      role="alert"
      style={{
        display: 'grid', width: '100%', minHeight: '100vh', placeItems: 'center',
        padding: '32px', color: '#e8e3d8', background: '#11110f',
        font: '400 13px/1.6 Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '48ch', display: 'grid', gap: '10px' }}>
        <strong style={{ color: '#d0a14b', fontSize: '15px' }}>Canvas did not open your diagrams</strong>
        <p style={{ margin: 0, color: '#a2a2aa' }}>
          The saved data could not be read, so nothing has been loaded and nothing will be
          written. Your file on disk is untouched.
        </p>
        <code style={{ color: '#777269', fontSize: '11px', wordBreak: 'break-all' }}>{detail}</code>
      </div>
    </main>
  );
}
