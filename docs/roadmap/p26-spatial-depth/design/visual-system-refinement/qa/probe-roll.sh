#!/usr/bin/env bash
# Focused check of the owner observation: the rotunda reads green while the flat↔360 roll
# (curvature) slider is mid-travel. Compares the two builds at matched camera states and
# separates the wall's own light pixels from the dark cutting mat, reporting both a strict
# "obviously green" share and the mean green excess (G − (R+B)/2) of light pixels, which
# catches a subtle cast the strict threshold misses.
#
# Usage: probe-roll.sh <url-base> [label]
#   url-base = http://localhost:8826 | http://localhost:8826/_baseline
set -e
cd "$(dirname "$0")"
BASE="${1:?usage: probe-roll.sh <url-base> [label]}"
LABEL="${2:-build}"
export AGENT_BROWSER_SESSION="p26roll-$LABEL"
U="$BASE/index.html?shot=1&motion=instant"
js() { agent-browser eval "$1" >/dev/null; }

MEASURE=$(cat <<'JS'
(() => {
  const st = __me.ctx.stage, src = document.getElementById('gl');
  const c2 = document.createElement('canvas');
  c2.width = src.width; c2.height = src.height;
  const g = c2.getContext('2d');
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c2.width, c2.height).data;
  let n = 0, r = 0, gg = 0, b = 0;
  let light = 0, lightGreen = 0, lightExcess = 0, dark = 0, darkGreen = 0, darkExcess = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    r += R; gg += G; b += B; n++;
    const ex = G - (R + B) / 2;
    const green = G > R + 6 && G > B + 6;
    if (R > 150) { light++; lightExcess += ex; if (green) lightGreen++; }
    else if (R < 90) { dark++; darkExcess += ex; if (green) darkGreen++; }
  }
  const ds = st.d('rotunda');
  return JSON.stringify({
    u: +ds.u.toFixed(3), sheet: !!ds.sheet, paper: +st.paper.toFixed(1),
    mean: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)],
    lightPct: +(100 * light / n).toFixed(1),
    lightExcess: +(lightExcess / Math.max(1, light)).toFixed(2),
    lightGreenPct: +(100 * lightGreen / n).toFixed(2),
    darkPct: +(100 * dark / n).toFixed(1),
    darkExcess: +(darkExcess / Math.max(1, dark)).toFixed(2),
    darkGreenPct: +(100 * darkGreen / n).toFixed(2),
  });
})()
JS
)
measure() { agent-browser eval "$MEASURE" | python3 -c 'import json,sys; s=json.load(sys.stdin); print("'"$LABEL"'", sys.argv[1], s)' "$1"; }
roll() { js "__me.A.unrollTo($1); 1"; sleep 1.6; }

agent-browser open "$U" >/dev/null; sleep 2.2

echo "--- 3D overview as loaded (mat background), rotunda rolled ---"
js "__me.A.select('rotunda'); 1"; sleep 0.8
roll 0; measure "3d u=0.00"
roll 0.35; measure "3d u=0.35"
roll 0.65; measure "3d u=0.65"
roll 1; measure "3d u=1.00"

echo "--- rotunda framed and squared (vellum background) ---"
js "__me.A.face('rotunda'); 1"; sleep 1.6
roll 0; measure "vel u=0.00"
roll 0.65; measure "vel u=0.65"
roll 1; measure "vel u=1.00"
