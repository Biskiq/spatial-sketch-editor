#!/usr/bin/env bash
# Samples the real 3D -> 2D paper move frame by frame and reports the background through it, so the
# "flicker" can be attributed rather than guessed.
#
# Three stacked layers share the ground plane: the opaque mat (its grid baked into its texture), the
# paper ground at alpha = paper, and a separate paper grid layer. The transition fades the paper in
# while the mat stays visible until paper = 0.999, and the background/fog colour follows paper.
#
# Patch = left quarter, lower half: no model, no overlay. Per sample:
#   paper  the page's stated progress      el   camera elevation
#   lum    mean luminance                  sd   spread within the patch
#   band   mean |row-to-row difference|    — counts thin grid lines too
#   wide   mean |difference| after smoothing rows over 7 px — the wide bands, i.e. the artifact
#
# Runs the move at teaching speed (never instant) from the same standpoint each time.
#
# Usage: probe-transition.sh <url-base> [label]
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: probe-transition.sh <url-base> [label]}"
LABEL="${2:-revised}"
export AGENT_BROWSER_SESSION="p26trans-$LABEL"
U="$BASE/index.html?shot=1&motion=teach"
js() { agent-browser eval "$1" >/dev/null; }

JSFILE="${TMPDIR:-/tmp}/p26-transition-eval.js"
cat > "$JSFILE" <<'JS'
(async () => {
  const st = __me.ctx.stage, src = document.getElementById('gl');
  const c2 = document.createElement('canvas');
  const g = c2.getContext('2d');
  const patch = () => {
    c2.width = src.width; c2.height = src.height;
    g.drawImage(src, 0, 0);
    const W = c2.width, H = c2.height;
    const x0 = Math.round(W * 0.02), x1 = Math.round(W * 0.26);
    const y0 = Math.round(H * 0.42), y1 = Math.round(H * 0.95);
    const lum = (R, G, B) => 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const row = (y) => {
      const d = g.getImageData(x0, y, x1 - x0, 1).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += lum(d[i], d[i + 1], d[i + 2]);
      return s / (x1 - x0);
    };
    const rows = [];
    for (let y = y0; y < y1; y++) rows.push(row(y));
    let sum = 0, sum2 = 0, band = 0;
    for (let i = 0; i < rows.length; i++) { sum += rows[i]; sum2 += rows[i] * rows[i]; }
    for (let i = 1; i < rows.length; i++) band += Math.abs(rows[i] - rows[i - 1]);
    const n = rows.length;
    const mean = sum / n;
    band /= n - 1;
    const K = 7;
    let wide = 0; let ns = 0; let prev = null;
    for (let i = 0; i + K < n; i++) {
      let s = 0;
      for (let k = 0; k <= K; k++) s += rows[i + k];
      s /= K + 1;
      if (prev !== null) { wide += Math.abs(s - prev); ns++; }
      prev = s;
    }
    wide /= Math.max(1, ns);
    return {
      p: +st.paper.toFixed(2), el: +st.cam.el.toFixed(2),
      mat: st.ground.visible ? 1 : 0, grid: st.grid.visible ? 1 : 0,
      lum: +mean.toFixed(1), band: +band.toFixed(2), wide: +wide.toFixed(3),
      sd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1),
    };
  };
  const out = [];
  const done = __me.A.squareUp();
  for (let i = 0; i < 60; i++) { out.push(patch()); await new Promise((r) => setTimeout(r, 30)); }
  await done;
  for (let i = 0; i < 5; i++) { out.push(patch()); await new Promise((r) => setTimeout(r, 30)); }
  return JSON.stringify(out);
})()
JS
RUN="$(cat "$JSFILE")"

sample() { agent-browser eval "$RUN" | python3 -c '
import json,sys
s = json.loads(sys.stdin.read())
if isinstance(s, str): s = json.loads(s)
print("'"$LABEL"'", sys.argv[1], "(%d samples)" % len(s))
seen = []
for r in s:
    if not seen or r["p"] != seen[-1]["p"] or r["lum"] != seen[-1]["lum"]:
        print("   p=%.2f el=%.2f mat=%d grid=%d  lum=%6.1f  band=%5.2f  wide=%6.3f  sd=%5.1f" % (r["p"], r["el"], r["mat"], r["grid"], r["lum"], r["band"], r["wide"], r["sd"]))
        seen.append(r)
mid = [r for r in s if 0.05 < r["p"] < 0.95]
print("   peak wide %.3f in 0.05<p<0.95   biggest single-step lum jump %.1f" % (
    (max(r["wide"] for r in mid) if mid else 0),
    max(abs(b["lum"] - a["lum"]) for a, b in zip(s, s[1:]))))
' "$1"; }

setup() {
  js "__me.A.go3D(); 1"; sleep 1.4
  js "__me.A.select('rotunda'); 1"; js "__me.A.unfold(); 1"; sleep 2.6
  js "(() => { const c = __me.ctx.stage.cam; c.el = 0.52; c.az = 0.9; c.frameH = 26; return 1; })()"; sleep 1.2
  hideModel
}

# The museum itself enters the sample patch once the camera tilts down, so the background is
# measured on its own.
hideModel() { js "(() => { const st = __me.ctx.stage; st.root.visible = false; st.fx.visible = false; return 1; })()"; }
showModel() { js "(() => { const st = __me.ctx.stage; st.root.visible = true; st.fx.visible = true; return 1; })()"; }

wrapMat() { js "(() => { const st = __me.ctx.stage; if (!st._origPaper) st._origPaper = st.applyPaper.bind(st); st.applyPaper = () => { st._origPaper(); st.ground.visible = false; }; return 1; })()"; }
wrapGrid() { js "(() => { const st = __me.ctx.stage; if (!st._origGrid) st._origGrid = st.applyGrid.bind(st); st.applyGrid = (p) => { st._origGrid(p); st.grid.visible = false; }; if (st._origPaper) st.applyPaper = st._origPaper; return 1; })()"; }
unwrap() { js "(() => { const st = __me.ctx.stage; if (st._origPaper) st.applyPaper = st._origPaper; if (st._origGrid) st.applyGrid = st._origGrid; return 1; })()"; }

agent-browser open "$U" >/dev/null; sleep 2.4
echo "--- as shipped ---"
setup; sample "shipped"
echo "--- mat hidden (paper ground + paper grid only) ---"
unwrap; wrapMat; setup; sample "no mat"
echo "--- paper grid hidden (mat + flat paper only) ---"
unwrap; wrapGrid; setup; sample "no grid"
unwrap
