import { S, ctx } from './state.js';

// One tween clock for every choreography. A new command never cuts a motion off
// mid-air: it hurries the running one to its end state, then runs.
const tweens = new Set();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function tween(ms, step) {
  return new Promise((resolve) => {
    if (ms <= 0 || S.hurry) { step(1); resolve(); return; }
    tweens.add({ t0: performance.now(), ms, step, resolve });
  });
}

export function tickTweens(now) {
  for (const tw of [...tweens]) {
    const t = Math.min(1, (now - tw.t0) / tw.ms);
    tw.step(t);
    if (t >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}

export function finishTweens() {
  for (const tw of [...tweens]) { tw.step(1); tweens.delete(tw); tw.resolve(); }
}

let chain = Promise.resolve();
export function run(fn) {
  if (S.busy) { S.hurry = true; finishTweens(); }
  chain = chain.then(async () => {
    S.busy = true;
    S.hurry = false;
    try { await fn(); } catch (e) { console.error(e); }
    finally { S.busy = false; S.hurry = false; narrate(null); ctx.ui(); }
  });
  return chain;
}

export const wait = (ms) => tween(ms, () => {});

// Motion that learns: a transition plays at teaching speed the first times you see it,
// then gets brisk. Shift makes any single move instant.
export function teaching(kind) {
  if (S.motion === 'teach') return true;
  if (S.motion !== 'adaptive') return false;
  return (S.seen[kind] || 0) < 2;
}

export function dur(kind, base) {
  if (S.shift || S.hurry || reduced.matches) return 0;
  switch (S.motion) {
    case 'instant': return 0;
    case 'teach': return base * 1.55;
    case 'brisk': return base * 0.42;
    default: return teaching(kind) ? base * 1.3 : base * 0.48;
  }
}

export function saw(kind) { S.seen[kind] = (S.seen[kind] || 0) + 1; }

export function narrate(text, kind) {
  const el = document.getElementById('caption');
  if (!el) return;
  if (!text || (kind && !teaching(kind)) || S.shift || S.motion === 'instant') { el.hidden = true; return; }
  el.innerHTML = text;
  el.hidden = false;
}
