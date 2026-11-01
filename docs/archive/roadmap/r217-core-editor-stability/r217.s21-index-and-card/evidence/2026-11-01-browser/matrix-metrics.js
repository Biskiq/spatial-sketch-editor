(() => {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const over = [...document.querySelectorAll('body *')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !el.closest('[hidden]'); })
    .slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').slice(0, 40));
  const row = document.querySelector('.item-row[aria-current="true"]');
  return JSON.stringify({
    viewport: [innerWidth, innerHeight],
    scrollWidth: sw,
    clientWidth: vw,
    horizontalOverflow: sw > vw,
    overflowingElements: over,
    card: box(document.querySelector('.card')),
    cardSource: document.querySelector('.card')?.getAttribute('data-source-id') ?? null,
    cardTitle: document.querySelector('.card h2.name')?.textContent ?? null,
    index: box(document.querySelector('.plate-index')),
    selectedRow: row?.getAttribute('aria-label') ?? null,
    chip: document.querySelector('[data-head-location]')?.textContent ?? null
  });
})()
