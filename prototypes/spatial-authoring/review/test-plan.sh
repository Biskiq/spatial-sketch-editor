#!/usr/bin/env bash
# Journey E check: author in Plan, tilt into 3D, face, precise edit, back, Undo — with real pointer drags.
R="$(cd "$(dirname "$0")" && pwd)"
export AGENT_BROWSER_SESSION=p26review
ab() { agent-browser "$@" >/dev/null; }
js() { agent-browser eval "$1"; }
at() { agent-browser eval "(() => { const e = document.querySelector('[data-h=\"$1\"]'); if (!e) return 'none'; const r = e.getBoundingClientRect(); return Math.round(r.x + r.width/2) + ',' + Math.round(r.y + r.height/2); })()" | tr -d '"'; }
drag() { local P; P=$(at "$1"); [ "$P" = none ] && { echo "no handle $1"; return; }; local X=${P%,*} Y=${P#*,}; ab mouse move "$X" "$Y"; ab mouse down left; ab mouse move $((X+$2/3)) $((Y+$3/3)); ab mouse move $((X+$2)) $((Y+$3)); ab mouse up left; }
state() { js "(() => { const { S, ctx } = __me; const o = ctx.museum.walls.find(w => w.id==='rotunda').openings.find(o => o.id==='gwin'); return JSON.stringify({ view: __me.A.viewLabel(), s: +o.s.toFixed(2), w: +o.w.toFixed(2), head: o.head, rise: o.rise, undo: S.undo.map(u => u.label), handles: [...document.querySelectorAll('#ovHtml [data-h]')].map(e => e.dataset.h), gated: S.gated }); })()"; }

ab set viewport 1440 900
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { __me.A.goPlan(); await new Promise(r => setTimeout(r, 300)); __me.A.select('gwin'); return 1; })()" >/dev/null; sleep 0.6
echo "-- plan"; state
ab screenshot "$R/n-02-plan-select.png"
drag h-move -60 40; sleep 0.3
drag h-jr 25 25; sleep 0.3
echo "-- after plan drags"; state
ab screenshot "$R/n-03-plan-edited.png"
js "(() => { __me.ctx.stage.cam.el = 0.8; return 1; })()" >/dev/null; sleep 0.5
echo "-- tilted to 46°"; state
ab screenshot "$R/n-04-tilted.png"
drag h-head 0 -30; sleep 0.3
echo "-- after head drag in 3D"; state
js "(async () => { __me.A.face('gwin'); return 1; })()" >/dev/null; sleep 0.8
echo "-- facing"; state
drag h-rise 0 20; sleep 0.3
echo "-- after rise in face"; state
ab screenshot "$R/n-05-face.png"
ab press Escape; sleep 0.8
echo "-- after Esc"; state
js "(() => JSON.stringify({ el: +__me.ctx.stage.cam.el.toFixed(3), summary: __me.S.summary && __me.S.summary.labels }))()"
ab screenshot "$R/n-06-back-summary.png"
ab press 1; sleep 0.8
js "(() => { __me.A.undo(); __me.A.undo(); return 1; })()" >/dev/null; sleep 0.3
echo "-- plan after two undos"; state
