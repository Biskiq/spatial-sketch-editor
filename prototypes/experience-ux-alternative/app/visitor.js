// Visitor preview — Guided tour and Free exploration over the same Presentations and Views.
// It reads the authored document; it owns no editor state and writes nothing back.
import { VisitorView } from './stage3d.js';
import { buildTimeline, evaluate, viewPose, blendPose, fmtTime } from './camera.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

export function openVisitor({ doc, stage3d, thumbs, mode, startStop = 0, onExit }) {
  const root = document.getElementById('visitor');
  root.hidden = false;
  root.innerHTML = `<div class="v-canvas" id="v-canvas"></div><div class="v-vignette"></div><div class="v-hud" id="v-hud"></div><div class="v-badge">Preview — what a visitor sees</div>`;
  const view = new VisitorView(stage3d, root.querySelector('#v-canvas'));
  const tl = buildTimeline(doc);
  const stops = doc.guide.stops;
  const P = (id) => doc.presentations.find((p) => p.id === id);
  const explorable = doc.presentations.filter((p) => p.explore);
  const st = {
    mode: 'choose', si: Math.min(startStop, Math.max(0, stops.length - 1)), t: 0, waiting: false, moving: false, paused: false, done: false,
    free: { viewId: null, anim: null, pose: null }, drawer: root.clientWidth > 760,
  };
  const firstPose = stops.length ? viewPose(doc.views[stops[0].seq[0].viewId]) : explorable.length ? viewPose(doc.views[explorable[0].defaultViewId]) : { pos: [2.4, 1.6, 10], dir: [1, 0, 0], fov: 60 };
  let pose = firstPose; view.set(pose);

  let last = performance.now(), alive = true;
  function frame(now) {
    if (!alive) return; requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (st.mode === 'guided' && !st.paused && !st.done) {
      const s = tl.stops[st.si];
      if (st.moving) {
        st.t += dt; if (st.t >= s.tEnd) { st.moving = false; st.si++; st.t = tl.stops[st.si].t0; hud(); }
      } else if (!st.waiting) {
        st.t += dt; if (st.t >= s.t1 - 0.001) { st.t = s.t1 - 0.001; st.waiting = true; hud(); }
      }
      const ev = evaluate(doc, tl, st.t); if (ev) pose = ev.pose;
      updateProgress();
    } else if (st.mode === 'free' && st.free.anim) {
      const a = st.free.anim; const k = Math.min(1, (now - a.t0) / a.ms);
      pose = blendPose(a.from, a.to, k); if (k >= 1) st.free.anim = null;
    }
    view.set(pose);
  }
  requestAnimationFrame(frame);

  function currentGuided() {
    const ev = evaluate(doc, tl, st.t); if (!ev) return {};
    const stop = stops[ev.si]; const vid = ev.seg.viewId || ev.seg.to;
    return { stop, p: P(stop.presId), v: doc.views[vid], vi: ev.seg.kind === 'hold' ? ev.seg.vi : stop.seq.findIndex((q) => q.viewId === ev.seg.to), travelling: st.moving && stop.out.mode === 'travel' };
  }
  function updateProgress() {
    root.querySelectorAll('.vp-seg').forEach((el, i) => {
      const s = tl.stops[i]; let f = 0;
      if (i < st.si) f = 1; else if (i === st.si) f = st.moving ? 1 : Math.min(1, (st.t - s.t0) / Math.max(0.01, s.t1 - s.t0));
      el.firstChild.style.width = (f * 100) + '%';
    });
    const g = currentGuided(); const cap = root.querySelector('.v-cap-view');
    if (cap && g.v) {
      const txt = g.travelling ? `On the way to Stop ${st.si + 2}` : g.v.name;
      if (cap.textContent !== txt) { cap.textContent = txt; root.querySelectorAll('.v-dots i').forEach((d, i) => d.classList.toggle('on', i === g.vi)); }
    }
  }

  function hud() {
    const h = root.querySelector('#v-hud');
    const top = `<div class="v-top"><div class="v-brand"><svg class="mark"><use href="#i-mark"/></svg><span>Salon Chopin</span></div>
      ${st.mode === 'guided' ? `<div class="v-progress" aria-label="Tour progress">${stops.map((s, i) => `<span class="vp-seg${i === st.si ? ' cur' : ''}" title="Stop ${i + 1}"><i></i></span>`).join('')}</div>` : st.mode === 'free' ? `<div class="v-mode-tag">${icon('compass', 'sm')}Exploring freely</div>` : '<span></span>'}
      <button class="v-btn ghost" data-v="exit">${icon('close', 'sm')}Exit preview</button></div>`;
    if (st.mode === 'choose') {
      const tlTotal = fmtTime(tl.total);
      h.innerHTML = top + `<div class="v-choose"><div class="v-choose-card">
        <small>Welcome to</small><h1>Salon Chopin</h1><p>A small wing of rooms around the composer’s Pleyel piano.</p>
        <div class="v-choices">
          <button class="v-choice primary" data-v="guided" ${stops.length ? '' : 'disabled'}>${icon('guide')}<b>Take the guided tour</b><span>${stops.length ? `${stops.length} stops · about ${tlTotal}` : 'No tour authored yet'}</span></button>
          <button class="v-choice" data-v="free" ${explorable.length ? '' : 'disabled'}>${icon('compass')}<b>Explore freely</b><span>${explorable.length} places to visit at your own pace</span></button>
        </div></div></div>`;
    } else if (st.mode === 'guided') {
      if (st.done) {
        h.innerHTML = top + `<div class="v-choose"><div class="v-choose-card"><small>End of the tour</small><h1>Thank you</h1><p>Stay a while — every room and view is still open to explore.</p>
          <div class="v-choices"><button class="v-choice primary" data-v="free">${icon('compass')}<b>Keep exploring</b><span>Including views the tour skipped</span></button><button class="v-choice" data-v="restart">${icon('guide')}<b>Start the tour again</b><span>From Stop 1</span></button></div></div></div>`;
        return;
      }
      const g = currentGuided(); const stop = stops[st.si]; const p = P(stop.presId);
      const last = st.si === stops.length - 1;
      h.innerHTML = top + `
        <div class="v-bottom">
          <div class="v-left"><button class="v-btn ghost" data-v="free">${icon('compass', 'sm')}Explore freely</button></div>
          <div class="v-caption"><small>Stop ${st.si + 1} of ${stops.length}</small><h2>${esc(p.name)}</h2><div class="v-cap-row"><span class="v-cap-view">${esc(g.v?.name || '')}</span>${stop.seq.length > 1 ? `<span class="v-dots">${stop.seq.map((_, i) => `<i class="${i === g.vi ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div></div>
          <div class="v-right">
            <button class="v-btn round ghost" data-v="prev" ${st.si === 0 ? 'disabled' : ''} aria-label="Previous stop">${icon('back')}</button>
            <button class="v-btn round ghost" data-v="pause" aria-label="${st.paused ? 'Resume' : 'Pause'}">${icon(st.paused ? 'play' : 'pause')}</button>
            <button class="v-btn primary${st.waiting ? ' ready' : ''}" data-v="next" ${st.moving ? 'disabled' : ''}>${last ? 'Finish tour' : 'Next stop'}${icon('arrow', 'sm')}</button>
          </div>
        </div>`;
      updateProgress();
    } else {
      const cur = st.free.viewId && doc.views[st.free.viewId]; const cp = cur && P(cur.presId);
      h.innerHTML = top + `
        <aside class="v-places${st.drawer ? '' : ' closed'}"><div class="v-places-head"><b>Places</b><button class="v-btn xs ghost" data-v="drawer">${st.drawer ? 'Hide' : 'Show places'}</button></div>
          <div class="v-places-list">${explorable.map((p) => `<section><h3>${esc(p.name)}</h3><div class="v-views">${p.viewIds.map((vid) => `<button class="v-view${st.free.viewId === vid ? ' on' : ''}" data-v="go" data-id="${vid}"><span style="background-image:url(${thumbs.get(doc.views[vid])})"></span><em>${esc(doc.views[vid].name)}</em></button>`).join('')}</div></section>`).join('')}</div></aside>
        <div class="v-bottom">
          <div class="v-left">${stops.length ? `<button class="v-btn ghost" data-v="resume">${icon('guide', 'sm')}${st.started ? `Back to the tour · Stop ${st.si + 1}` : 'Take the guided tour'}</button>` : ''}</div>
          <div class="v-caption">${cur ? `<small>${esc(cp.name)}</small><h2>${esc(cur.name)}</h2><div class="v-cap-row"><span class="v-hint">Drag to look around</span></div>` : '<h2>Choose a place</h2>'}</div>
          <div class="v-right"></div>
        </div>`;
    }
  }

  function goFree(viewId, ms = 1300) {
    const to = viewPose(doc.views[viewId]);
    st.free.viewId = viewId; st.free.anim = { from: pose, to, t0: performance.now(), ms }; hud();
  }
  function startGuided(si = 0, fromStart = true) {
    st.mode = 'guided'; st.started = true; st.done = false; st.si = si; st.t = tl.stops[si].t0; st.waiting = false; st.moving = false; st.paused = false; hud();
  }
  function next() {
    if (st.moving) return;
    if (st.si >= stops.length - 1) { st.done = true; hud(); return; }
    const s = tl.stops[st.si]; st.waiting = false; st.paused = false;
    if (s.tEnd > s.t1) { st.moving = true; st.t = s.t1; } else { st.si++; st.t = tl.stops[st.si].t0; }
    hud();
  }
  function onClick(e) {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const a = b.dataset.v;
    if (a === 'exit') return close();
    if (a === 'guided') return startGuided(Math.min(startStop, stops.length - 1));
    if (a === 'restart') return startGuided(0);
    if (a === 'free') { st.mode = 'free'; st.done = false; const first = st.started ? stops[st.si].seq[0].viewId : (explorable[0]?.defaultViewId); if (st.started) { st.free.viewId = currentGuided().v?.id || null; st.free.anim = null; hud(); } else if (first) goFree(first, 900); else hud(); return; }
    if (a === 'go') return goFree(b.dataset.id);
    if (a === 'resume') { const si = st.started ? st.si : 0; st.free.anim = null; startGuided(si); return; }
    if (a === 'next') return next();
    if (a === 'prev') { if (st.si > 0) startGuided(st.si - 1); return; }
    if (a === 'pause') { st.paused = !st.paused; hud(); return; }
    if (a === 'drawer') { st.drawer = !st.drawer; hud(); }
  }
  root.addEventListener('click', onClick);
  // free look (free mode only — guided camera is authored)
  let drag = null;
  const onDown = (e) => { if (st.mode !== 'free' || e.target.closest('.v-hud button, .v-places')) return; drag = { x: e.clientX, y: e.clientY }; };
  const onMove = (e) => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    st.free.anim = null;
    let yaw = Math.atan2(pose.dir[2], pose.dir[0]) - dx * 0.004, pitch = Math.max(-1, Math.min(1, Math.asin(pose.dir[1]) + dy * 0.004));
    pose = { ...pose, dir: [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)] };
  };
  const onUp = () => { drag = null; };
  root.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (st.mode === 'guided' && (e.key === 'ArrowRight' || e.key === 'Enter')) next();
  };
  window.addEventListener('keydown', onKey);

  function close() {
    alive = false; view.dispose(); root.removeEventListener('click', onClick); root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey);
    root.hidden = true; root.innerHTML = ''; onExit();
  }

  if (mode === 'guided' && stops.length) startGuided(Math.min(startStop, stops.length - 1));
  else if (mode === 'free' && explorable.length) { st.mode = 'free'; goFree(explorable[0].defaultViewId, 10); }
  else hud();
  return { close };
}
