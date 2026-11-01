(() => {
  const head = document.querySelector('[data-editor-head]');
  const hr = head.getBoundingClientRect();
  const shown = (e) => e.getClientRects().length > 0 && (e.matches('summary') || !e.closest('details:not([open])'));
  const vis = [...head.querySelectorAll('button, summary, [data-head-project]')].filter(shown);
  const centers = vis.map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
  const band = Math.max(...centers) - Math.min(...centers);
  const outside = vis.filter((e) => { const r = e.getBoundingClientRect(); return r.top < hr.top - 0.5 || r.bottom > hr.bottom + 0.5 || r.right > window.innerWidth + 0.5; }).map((e) => (e.textContent || '').trim().slice(0, 24));
  const minTarget = Math.min(...vis.map((e) => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  return JSON.stringify({
    width: window.innerWidth, headH: Math.round(hr.height), controls: vis.length,
    rowBandPx: Math.round(band * 10) / 10, outside, minTargetPx: minTarget, coarse: matchMedia('(pointer: coarse)').matches,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    shown: vis.map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22))
  });
})()
