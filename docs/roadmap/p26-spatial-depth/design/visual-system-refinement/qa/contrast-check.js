// Measures WCAG contrast for the revised demo treatment, read from the running stylesheet and
// renderer palette. Run with:
//   agent-browser eval "$(cat qa/contrast-check.js)"
(() => {
  const cs = getComputedStyle(document.documentElement);
  const tok = (n) => cs.getPropertyValue(n).trim();
  const hex = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pair = (name, fg, bg, kind) => ({
    pair: name, kind, ratio: +ratio(hex(fg), hex(bg)).toFixed(2),
  });

  const mat = '#1D3A33', chassis = tok('--chassis'), paper = tok('--paper');
  const rows = [
    pair('shell main / paper (surface step)', chassis, paper, 'surface'),
    pair('perimeter / shell', tok('--perimeter'), chassis, 'non-text'),
    pair('perimeter / paper', tok('--perimeter'), paper, 'non-text'),
    pair('ochre / mat', tok('--ochre'), mat, 'non-text'),
    pair('dark ochre / paper', tok('--ochre-deep'), paper, 'non-text'),
    pair('dark ochre / shell', tok('--ochre-deep'), chassis, 'non-text'),
    pair('charcoal / mat', tok('--ink'), mat, 'non-text'),
    pair('ink / shell', tok('--ink'), chassis, 'text'),
    pair('ink-2 / shell', tok('--ink-2'), chassis, 'text'),
    pair('ink-3 / shell', tok('--ink-3'), chassis, 'text'),
    pair('view / shell (stroke value)', tok('--view'), chassis, 'text'),
    pair('view-ink / shell', tok('--view-ink'), chassis, 'text'),
    pair('view-ink / view-soft', tok('--view-ink'), tok('--view-soft'), 'text'),
    pair('view / view-soft (stroke value)', tok('--view'), tok('--view-soft'), 'text'),
    pair('white / view (active segment)', '#FFFFFF', tok('--view'), 'text'),
    pair('ink / instrument', tok('--ink'), tok('--instrument'), 'text'),
    pair('caution body / caution bg', tok('--caution-body'), tok('--caution-bg'), 'text'),
    pair('caution action / caution bg', tok('--caution-action'), tok('--caution-bg'), 'text'),
    pair('caution accent / caution bg', tok('--caution-accent'), tok('--caution-bg'), 'non-text'),
    pair('refuse ink / refuse bg', tok('--refuse-ink'), tok('--refuse-bg'), 'text'),
    pair('refuse edge / refuse bg', tok('--refuse-edge'), tok('--refuse-bg'), 'non-text'),
    pair('refuse bg / mat', tok('--refuse-bg'), mat, 'non-text'),
    pair('refuse edge / mat', tok('--refuse-edge'), mat, 'non-text'),
    pair('open deep / open soft', tok('--open-deep'), tok('--open-soft'), 'text'),
    pair('ink / ochre (glyph on handle)', tok('--ink-dark'), tok('--ochre'), 'text'),
    pair('white / ochre (rejected)', '#FFFFFF', tok('--ochre'), 'text'),
    pair('brand tape / shell', tok('--tape'), chassis, 'non-text'),
    pair('ink / brand tape', tok('--ink'), tok('--tape'), 'text'),
    // the selection role, which the owner ruling on this branch resolves to the tape gold, so it is
    // measured where it is actually used: a mark on the shell, on paper and on the mat
    pair('selection / shell', tok('--sel'), chassis, 'non-text'),
    pair('selection / paper', tok('--sel'), paper, 'non-text'),
    pair('selection edge / paper', tok('--sel-edge'), paper, 'non-text'),
    pair('selection edge / shell', tok('--sel-edge'), chassis, 'non-text'),
    pair('selection / mat', tok('--sel'), mat, 'non-text'),
    pair('ink-dark / selection (glyph on handle)', tok('--ink-dark'), tok('--sel'), 'text'),
  ];

  // drafting-grid lines are decorative: measure their composite against the paper they sit on
  const grid = (name, colour, alpha) => {
    const comp = over(hex(colour), hex(paper), alpha);
    return { pair: name, kind: 'decorative grid', ratio: +ratio(comp, hex(paper)).toFixed(3) };
  };
  rows.push(grid(`minor grid ${tok('--ochre') && ''}#9FB2A2 @ .28 / paper`, '#9FB2A2', 0.28));
  rows.push(grid('major grid #809984 @ .45 / paper', '#809984', 0.45));
  rows.push(grid('mat minor #2B5147 @ 1 / mat', '#2B5147', 1));
  rows.push(grid('mat major #3C6A5C @ 1 / mat', '#3C6A5C', 1));

  const fails = rows.filter((r) => (r.kind === 'text' ? r.ratio < 4.5 : r.kind === 'non-text' ? r.ratio < 3 : false));
  return JSON.stringify({ rows, fails }, null, 1);
})()
