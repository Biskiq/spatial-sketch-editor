#!/usr/bin/env bash
# Sweeps the contextual drafting sheet's calibration (grid alpha, emissive) with everything else
# hidden, so the wall's own reading is measured instead of the paper ground's. Reference rows:
# the same wall as foam (u = 0, the un-rolled "architecture" reading) and the bare paper
# background. Prints frame mean, green excess over light pixels, strictly-green share and the
# luminance spread (a proxy for grid legibility).
#
# Usage: probe-sheet.sh <url-base> [label]
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: probe-sheet.sh <url-base> [label]}"
LABEL="${2:-revised}"
export AGENT_BROWSER_SESSION="p26sheet-$LABEL"
U="$BASE/index.html?shot=1&motion=instant"
js() { agent-browser eval "$1" >/dev/null; }

MEASURE=$(cat <<'JS'
(() => {
  const src = document.getElementById('gl');
  const c2 = document.createElement('canvas');
  c2.width = src.width; c2.height = src.height;
  const g = c2.getContext('2d');
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c2.width, c2.height).data;
  let n = 0, r = 0, gg = 0, b = 0, light = 0, ex = 0, green = 0, sum = 0, sum2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    r += R; gg += G; b += B; n++;
    const e = G - (R + B) / 2;
    if (R > 150) {
      light++;
      ex += e;
      if (G > R + 6 && G > B + 6) green++;
      const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      sum += lum; sum2 += lum * lum;
    }
  }
  const mean = sum / Math.max(1, light);
  const sd = Math.sqrt(Math.max(0, sum2 / Math.max(1, light) - mean * mean));
  const M = [Math.round(r / n), Math.round(gg / n), Math.round(b / n)];
  return JSON.stringify({
    mean: M,
    dGR: M[1] - M[0],
    dGB: M[1] - M[2],
    lightPct: +(100 * light / n).toFixed(1),
    excess: +(ex / Math.max(1, light)).toFixed(2),
    greenPct: +(100 * green / n).toFixed(2),
    sdLum: +sd.toFixed(1),
  });
})()
JS
)
measure() { agent-browser eval "$MEASURE" | python3 -c 'import json,sys; s=json.load(sys.stdin); print("'"$LABEL"'", sys.argv[1].ljust(22), s)' "$1"; }
roll() { js "__me.A.unrollTo($1); 1"; sleep 1.5; }

# redraws the sheet's tile in place with given grid alphas (same geometry as gridTexture)
SET=$(cat <<'JS'
(() => {
  const st = __me.ctx.stage, m = st.mat.sheet, c = m.map.image, g = c.getContext('2d'), size = c.width;
  m.emissiveIntensity = AEM;
  g.clearRect(0, 0, size, size);
  g.fillStyle = '#F3F4EE'; g.fillRect(0, 0, size, size);
  const cells = 5;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * size, isMaj = i % 5 === 0;
    g.globalAlpha = isMaj ? AMAJ : AMIN;
    g.strokeStyle = isMaj ? '#809984' : '#9FB2A2';
    g.lineWidth = isMaj ? 5 : 3;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke();
  }
  g.globalAlpha = 1;
  m.map.needsUpdate = true;
  return 1;
})()
JS
)
sweep() { js "$(printf '%s' "$SET" | sed "s/AEM/$1/; s/AMIN/$2/; s/AMAJ/$3/")" >/dev/null; sleep 0.5; }

agent-browser open "$U" >/dev/null; sleep 2.2
js "__me.A.select('rotunda'); 1"; js "__me.A.face('rotunda'); 1"; sleep 1.6
echo "--- bare paper background (wall and ground hidden) ---"
js "(() => { const st = __me.ctx.stage; st.groundOn = false; st.applyPaper();
  for (const [id, it] of st.items) { if (it.mesh) it.mesh.visible = false; if (it.lines) it.lines.visible = false; } return 1; })()"
sleep 1.5; measure "background only"
js "(() => { const st = __me.ctx.stage; for (const [id, it] of st.items) { const on = id === 'rotunda'; if (it.mesh) it.mesh.visible = on; if (it.lines) it.lines.visible = on; } return 1; })()"
sleep 1.0
echo "--- reference: the same wall as foam (u = 0, sheet material off) ---"
roll 0; measure "foam wall (reference)"

echo "--- as shipped, then sweep: emissive x grid alpha (minor/major) ---"
roll 1; measure "sheet as shipped"
for e in 0.08 0.36; do
  for a in "0.34 0.55" "0.20 0.34"; do
    set -- $a
    sweep "$e" "$1" "$2"
    measure "em=$e a=$1/$2"
  done
done
