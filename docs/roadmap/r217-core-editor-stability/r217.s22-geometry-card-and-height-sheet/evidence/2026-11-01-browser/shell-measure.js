(() => {
  // R217.S22 shell probe: measures the Card, Height Sheet, zoom cluster, dock, palette,
  // Index, Stage actions and pin hint in CSS px, and lists every pairwise box overlap.
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { l: +b.left.toFixed(1), t: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  const shown = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return el.getBoundingClientRect().width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const named = {
    card: document.querySelector('aside.card'),
    sheet: document.querySelector('[data-stage-height-sheet]'),
    hint: document.querySelector('p.hint[data-pin-hint]'),
    zoom: document.querySelector('[data-stage-zoom]'),
    dock: document.querySelector('nav[aria-label="Tools"]'),
    palette: document.querySelector('[data-stage-instrument]'),
    index: document.querySelector('.plate-index'),
    stageActions: document.querySelector('.stage-actions'),
  };
  const rects = {};
  for (const [key, el] of Object.entries(named)) if (shown(el)) rects[key] = box(el);
  const hits = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
  const keys = Object.keys(rects);
  const overlaps = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      if (hits(rects[keys[i]], rects[keys[j]])) overlaps.push([keys[i], keys[j]]);
    }
  }
  const root = document.documentElement;
  const card = document.querySelector('aside.card');
  return JSON.stringify({
    viewport: [innerWidth, innerHeight],
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
    horizontalOverflow: root.scrollWidth > root.clientWidth,
    cardGesturing: card ? card.getAttribute('data-card-gesturing') : null,
    cardCollapsed: card ? card.querySelector('.head-actions button')?.textContent?.trim() ?? null : null,
    rects,
    overlaps,
    overlapCount: overlaps.length
  });
})()
