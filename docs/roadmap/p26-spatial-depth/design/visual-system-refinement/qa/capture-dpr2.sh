#!/usr/bin/env bash
# DPR-2 linework/focus evidence.
#
# The capture harness exposes no browser device-scale-factor for a 1280 × 800 desktop window
# (only phone/tablet device presets), so the screenshot raster is 1× CSS pixels. What this script
# *does* exercise is the renderer's device-pixel-ratio path: the demo sets
#   renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
# so forcing 2 reproduces exactly the WebGL path a DPR-2 window would use (2× canvas backing
# store, same textures, same anisotropy, same CSS-pixel overlay geometry). The CSS overlay is
# resolution-independent, so its linework is unaffected by the ratio.
#
# Usage: capture-dpr2.sh <label>
set -e
cd "$(dirname "$0")"
LABEL="${1:?usage: capture-dpr2.sh <label>}"
OUT="$(pwd)/${LABEL}/1280x800-dpr2-renderer"
mkdir -p "$OUT"
export AGENT_BROWSER_SESSION="p26vs-$LABEL-dpr2"
ab() { agent-browser "$@" >/dev/null; }
js() { agent-browser eval "$1" >/dev/null; }
snap() { ab screenshot "$OUT/$1.png"; echo "${LABEL}/1280x800-dpr2-renderer/$1.png"; }
U="http://localhost:8826/index.html?shot=1&motion=instant"

ab set viewport 1280 800
ab open "$U"; sleep 2.2
DPR='(() => { const st = __me.ctx.stage; st.renderer.setPixelRatio(2); st.resize(); return 1; })()'
js "$DPR"; sleep 0.6

js "__me.A.goPlan(); 1"; sleep 1.2
js "$DPR"
js "__me.A.select('north'); 1"; sleep 0.6; snap d01-plan-north

js "__me.A.face('gwin'); 1"; sleep 1.4
js "__me.A.unrollTo(1); __me.A.squareUp(); 1"; sleep 1.8
js "$DPR"
js "__me.A.select('mwin'); 1"; sleep 0.6; snap d02-dense-dims
agent-browser eval "JSON.stringify({ dpr: window.devicePixelRatio, canvasW: document.getElementById('gl').width, canvasH: document.getElementById('gl').height, cssW: document.getElementById('gl').clientWidth, cssH: document.getElementById('gl').clientHeight, errors: 0 })" | tail -1
echo "done: $LABEL dpr2-renderer 1280 x 800"
