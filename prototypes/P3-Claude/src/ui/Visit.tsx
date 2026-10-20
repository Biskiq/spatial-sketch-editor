// The visitor's view: no creator tools at all — a title, a caption, and quiet controls.
import { useEffect } from 'preact/hooks';
import { store } from '../store';
import { app, usePlayer } from './ctx';

export function Visit() {
  const pl = usePlayer();
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (store.ui.mode !== 'visit') return;
      if (e.key === 'Escape') app.player.stop();
      if (e.key === ' ') (e.preventDefault(), app.player.toggle());
      if (e.key === 'ArrowRight') app.player.step(1);
      if (e.key === 'ArrowLeft') app.player.step(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  if (store.ui.mode !== 'visit' || !pl) return null;
  const s = pl.state;
  return (
    <div class="visit">
      <div class="bar">
        <i style={{ width: `${Math.round(s.progress * 100)}%` }} />
      </div>
      <div class="title">{store.project.name}</div>
      <button class="exit" onClick={() => pl.stop()}>
        Leave visit
      </button>
      <div class="cap" style={{ opacity: s.caption ? 1 : 0 }}>
        {s.caption}
      </div>
      {s.ended ? (
        <div class="endcard">
          <div>
            {store.project.name}
            <br />
            <button onClick={() => pl.start()}>Walk it again</button> <button onClick={() => pl.stop()}>Leave</button>
          </div>
        </div>
      ) : (
        <div class="ctrl">
          <button onClick={() => pl.step(-1)} title="Previous moment (←)">
            ‹
          </button>
          <button onClick={() => pl.toggle()} title="Pause (space)">
            {s.playing ? 'Pause' : 'Play'}
          </button>
          <div class="dots">
            {Array.from({ length: s.count }, (_, i) => (
              <i class={i <= s.index ? 'on' : ''} />
            ))}
          </div>
          <button onClick={() => pl.step(1)} title="Next moment (→)">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
