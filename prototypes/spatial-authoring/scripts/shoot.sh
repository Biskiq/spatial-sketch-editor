#!/usr/bin/env bash
# Re-renders every screen used by rationale.html from live prototype states.
# Needs the prototype served on :8826 (python3 -m http.server 8826) and agent-browser.
set -e
cd "$(dirname "$0")/.."
OUT="$(pwd)/screens"
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-p26shots}
U="http://localhost:8826/index.html?shot=1&motion=teach"
UI="http://localhost:8826/index.html?shot=1&motion=instant"
ab() { agent-browser "$@" >/dev/null; }
go() { ab open "${1:-$U}"; sleep 2.2; }
js() { agent-browser eval "$1" >/dev/null; }
snap() { ab screenshot "$OUT/$1.png"; echo "screens/$1.png"; }
at() { agent-browser eval "(() => { const e = document.querySelector('$1'); if (!e) return '0,0'; const r = e.getBoundingClientRect(); return Math.round(r.x + ${2:-r.width/2}) + ',' + Math.round(r.y + ${3:-r.height/2}); })()" | tr -d '"'; }

ab set viewport 1440 900

go
js "__me.A.select('gwin'); 1"; sleep 0.5; snap 01-3d
js "__me.A.goPlan(); 1"; sleep 0.95; snap 02-tilt-mid
sleep 1.6; js "__me.A.select(null); 1"; sleep 0.3; snap 03-plan

go
js "__me.A.select('gwin'); __me.A.face('gwin'); 1"; sleep 1.0; snap 04-face-mid
sleep 1.6; snap 05-face
js "__me.A.unfold(); 1"; sleep 1.15; snap 06-unfold-mid
sleep 1.8; snap 07-flat
js "__me.ctx.stage.cam.frameH *= 2.7; 1"; sleep 0.4; snap 08-flat-sheet
js "__me.S.motion='brisk'; __me.A.unrollTo(0.5); __me.A.stepBack(); 1"; sleep 2.2; snap 08b-curved-3d
js "__me.S.motion='teach'; 1"

go
js "__me.A.startKnife(); 1"; sleep 0.4
js "__me.A.presetKnife([-17,0.25],[13,0.25],-1,6); 1"; sleep 0.8; snap 09-knife-3d
js "__me.A.commitKnife(); 1"; sleep 1.2; snap 10-part-mid
sleep 2.4; js "__me.A.select('gdoor'); 1"; sleep 0.3; snap 11-section
js "__me.A.setDepth(3); __me.A.select('harbor'); 1"; sleep 0.5; snap 12-depth-locator
js "__me.S.motion='instant'; __me.A.goToHost('harbor'); 1"; sleep 0.8; snap 12b-nested
js "__me.A.closeSession(); 1"; sleep 0.8
js "__me.A.toggleReveal('harbor'); 1"; sleep 0.4; snap 12c-reveal

go
js "__me.A.select('north'); 1"; sleep 0.3; snap 13-wall-explains
js "__me.A.lift('longc'); 1"; sleep 1.0; snap 14-lift-mid
sleep 1.8
js "(() => { const o = __me.A.gapOptions('north','longc'); __me.S.popover = { wall:'north', ceil:'longc', opts:o }; __me.A.previewOption(o[1]); __me.ctx.ui(); return 1; })()"; sleep 0.5; snap 15-lift-preview
js "(() => { const p = __me.S.popover; __me.A.unpreview(); __me.A.commitOption(p.opts[0]); return 1; })()"; sleep 0.4
js "__me.A.lookUp('longc'); 1"; sleep 3.4; snap 16-lookup-mid
sleep 2.0; js "__me.A.select('soffit'); 1"; sleep 0.3; snap 17-lookup

go
js "__me.S.motion='instant'; __me.A.select('entrance'); __me.A.face('entrance'); 1"; sleep 0.6
P=$(at '[data-h="h-head"]'); X=${P%,*}; Y=${P#*,}
ab mouse move "$X" "$Y"; ab mouse down left; ab mouse move "$X" $((Y-40)); ab mouse move "$X" $((Y-260)); sleep 0.3; snap 18-refusal
ab mouse up left

# ---- added in the review reconciliation
[ "$1" = new ] || true

go "$UI"
js "__me.A.select('gwin'); 1"; sleep 0.5
P=$(at '[data-peel]' 8 8); X=${P%,*}; Y=${P#*,}
ab mouse move $X $Y; ab mouse down left; ab mouse move $((X-40)) $((Y+30)); ab mouse move $((X-100)) $((Y+80)); sleep 0.4; snap 19-peel-mid
ab mouse up left; sleep 0.5; snap 20-peeled-outside
js "__me.A.setSide(1); 1"; sleep 0.6; js "__me.A.squareUp(); 1"; sleep 0.8; snap 20b-heights-to-scale
js "__me.A.unrollTo(1); __me.A.squareUp(); 1"; sleep 0.8; snap 20c-flat-to-scale

go "$UI"
js "(async () => { __me.A.goPlan(); await new Promise(r => setTimeout(r, 300)); __me.A.select('gwin'); return 1; })()"; sleep 0.8; snap 21-plan-author
js "(() => { __me.ctx.stage.cam.el = 0.8; __me.ctx.stage.cam.frameH = 17; __me.ctx.stage.cam.target.set(4, 1, 2); return 1; })()"; sleep 0.6; snap 22-tilt-handles
js "(async () => { __me.A.face('gwin'); await new Promise(r => setTimeout(r, 300)); __me.A.editOnce('Garden window arch rise', () => __me.A.applyOpening('gwin', { rise: 0.55 })); __me.A.editOnce('Garden window sill', () => __me.A.applyOpening('gwin', { sill: 0.7 })); __me.A.closeSession(); return 1; })()"; sleep 1.0; snap 23-summary

go "$UI"
js "(async () => { __me.A.goPlan(); await new Promise(r => setTimeout(r, 300)); __me.A.startKnife(); await new Promise(r => setTimeout(r, 200)); __me.A.presetKnife([-17,-1.2],[13,-1.2],-1,6); return 1; })()"; sleep 0.8; snap 24-knife-slide

go "$UI"
ab press /; sleep 0.2; ab type "#finderInput" "tide"; sleep 0.4; snap 25-find
ab press Enter; sleep 0.6; snap 26-find-behind
