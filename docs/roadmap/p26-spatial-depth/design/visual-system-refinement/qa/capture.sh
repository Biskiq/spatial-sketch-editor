#!/usr/bin/env bash
# Captures the §9.2 specimens at matched camera/fixture settings.
# Usage: capture.sh <label> [width] [height]
#   label = baseline | revised (any folder name under qa/)
# Requires the prototype served on :8826 and agent-browser.
set -e
cd "$(dirname "$0")"
LABEL="${1:?usage: capture.sh <label> [w] [h]}"
W="${2:-1440}"
H="${3:-900}"
OUT="$(pwd)/${LABEL}/${W}x${H}"
mkdir -p "$OUT"
export AGENT_BROWSER_SESSION="p26vs-$LABEL-$W"
U="http://localhost:8826/index.html?shot=1&motion=instant"
ab() { agent-browser "$@" >/dev/null; }
go() { ab open "$U"; sleep 2.2; }
js() { agent-browser eval "$1" >/dev/null; }
snap() { ab screenshot "$OUT/$1.png"; echo "${LABEL}/${W}x${H}/$1.png"; }
at() { agent-browser eval "(() => { const e = document.querySelector('$1'); if (!e) return '0,0'; const r = e.getBoundingClientRect(); return Math.round(r.x + ${2:-r.width/2}) + ',' + Math.round(r.y + ${3:-r.height/2}); })()" | tr -d '"'; }

ab set viewport "$W" "$H"

# V1 — Plan, North wall selected
go
js "__me.A.goPlan(); 1"; sleep 1.2
js "__me.A.select('north'); 1"; sleep 0.6; snap v01-plan-north

# V2 — 3D overview, opening selected
go
js "__me.A.select('gwin'); 1"; sleep 0.6; snap v02-3d-gwin

# V3 — Garden window facing, fully unrolled
js "__me.A.face('gwin'); 1"; sleep 1.4
js "__me.A.unrollTo(1); 1"; sleep 1.2
js "__me.A.squareUp(); 1"; sleep 1.2; snap v03-face-flat-gwin

# V4 — partly peeled, inside then outside
go
js "__me.A.face('rotunda'); 1"; sleep 1.2
js "__me.A.unrollTo(0.5); 1"; sleep 1.4; snap v04a-peel-inside
js "__me.A.setSide(-1); 1"; sleep 1.4; snap v04b-peel-outside

# V5 — section with depth and view-only displacement
go
js "__me.A.startKnife(); 1"; sleep 0.4
js "__me.A.presetKnife([-17,0.25],[13,0.25],-1,6); 1"; sleep 0.8
js "__me.A.commitKnife(); 1"; sleep 1.6
js "__me.A.select('gdoor'); 1"; sleep 0.6
js "__me.A.setDepth(3); 1"; sleep 0.8; snap v05-section-depth

# V6 — lifted ceiling, clearance notice, then look up
go
js "__me.A.lift('longc'); 1"; sleep 1.8
js "(() => { const o = __me.A.gapOptions('north','longc'); __me.S.popover = { wall:'north', ceil:'longc', opts:o }; __me.ctx.ui(); return 1; })()"; sleep 0.6; snap v06a-lift-clearance
go
js "__me.A.lookUp('longc'); 1"; sleep 1.8; snap v06b-lookup

# V7 — dense dimensions, rotunda wall laid flat with an opening selected
go
js "__me.A.face('rotunda'); 1"; sleep 1.2
js "__me.A.unrollTo(1); 1"; sleep 1.4
js "__me.A.squareUp(); 1"; sleep 1.2
js "__me.A.select('mwin'); 1"; sleep 0.6; snap v07-dense-dims

# V8 — real handle drag in progress
go
js "__me.A.select('gwin'); __me.A.face('gwin'); 1"; sleep 1.4
P=$(at '[data-h="h-head"]'); X=${P%,*}; Y=${P#*,}
ab mouse move "$X" "$Y"; ab mouse down left; ab mouse move "$X" $((Y-30)); ab mouse move "$X" $((Y-120)); sleep 0.4; snap v08a-drag-active
ab mouse up left; sleep 0.6; snap v08b-drag-released

# V9 — numeric entry with invalid input
go
js "__me.A.select('gwin'); __me.A.face('gwin'); 1"; sleep 1.4
P=$(at '[data-edit]'); X=${P%,*}; Y=${P#*,}
ab mouse move "$X" "$Y"; ab mouse down left; ab mouse up left; sleep 0.5
js "(() => { const i = document.getElementById('typeinInput'); if (!i) return 0; i.value = 'abc'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()"; sleep 0.5; snap v09-invalid-entry

# V10 — set aside, find, return
go
js "__me.A.face('north'); 1"; sleep 1.4; snap v10a-set-aside
js "__me.A.closeSession(); 1"; sleep 1.0
js "__me.A.startKnife(); 1"; sleep 0.4
js "__me.A.presetKnife([-17,0.25],[13,0.25],-1,6); 1"; sleep 0.6
js "__me.A.commitKnife(); 1"; sleep 1.4
js "__me.A.toggleReveal('harbor'); 1"; sleep 0.6; snap v10b-reveal

# V11 — focus, hover, armed, selected, disabled
go
js "__me.A.startKnife(); 1"; sleep 0.5
js "document.querySelector('.motion [data-motion=\"instant\"]').focus(); 1"; sleep 0.4
js "__me.A.select('north'); 1"; sleep 0.5; snap v11-states

# V12 — return with ordinary motion (mid-flight) and instant endpoint
go_teach() { ab open "http://localhost:8826/index.html?shot=1&motion=teach"; sleep 2.2; }
go_teach
js "__me.A.select('gwin'); __me.A.face('gwin'); 1"; sleep 2.2
js "__me.A.closeSession(); 1"; sleep 0.45; snap v12a-return-mid
sleep 2.0; snap v12b-return-endpoint
echo "done: $LABEL $W x $H"
