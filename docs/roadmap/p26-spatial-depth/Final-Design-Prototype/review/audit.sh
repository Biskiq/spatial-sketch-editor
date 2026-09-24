#!/usr/bin/env bash
# Measures the review hypotheses against the running prototypes (needs :8826 and :8765).
cd "$(dirname "$0")"; R="$(pwd)"
export AGENT_BROWSER_SESSION=p26review
ab() { agent-browser "$@" >/dev/null; }
js() { agent-browser eval "$1"; }
ab set viewport 1440 900

echo "== space given to the museum (1440x900)"
ab open "http://localhost:8826/index.html?shot=1"; sleep 2.5
js "(() => { const r = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width); const w = document.querySelector('#where').getBoundingClientRect(); return JSON.stringify({ stage: r('#stage'), nav: r('.nav'), insp: r('.insp'), minimap: [Math.round(w.width), Math.round(w.height)] }); })()"
ab open "http://localhost:8765/prototype.html"; sleep 2.5
js "(() => { const c = document.querySelector('#stage') || document.querySelector('canvas'); return JSON.stringify({ stage: Math.round(c.getBoundingClientRect().width) }); })()"

echo "== time from O on the Rotunda wall to an editable, settled sheet (first time, adaptive)"
ab open "http://localhost:8826/index.html?shot=1"; sleep 2.5
js "(async () => { const { S, A } = __me; A.select('rotunda'); const t0 = performance.now(); A.unfold(); await new Promise(r => setTimeout(r, 50)); while (S.busy) await new Promise(r => setTimeout(r, 30)); return 'P26 first: ' + Math.round(performance.now() - t0) + ' ms'; })()"
js "(async () => { const { S, A } = __me; await new Promise(r => setTimeout(r, 200)); A.closeSession(); await new Promise(r => setTimeout(r, 60)); while (S.busy) await new Promise(r => setTimeout(r, 30)); A.select('rotunda'); const t0 = performance.now(); A.unfold(); await new Promise(r => setTimeout(r, 50)); while (S.busy) await new Promise(r => setTimeout(r, 30)); return 'P26 second: ' + Math.round(performance.now() - t0) + ' ms'; })()"

echo "== strip overflow in the densest state (facing the Rotunda, 1440 and 1280)"
js "(() => { const s = document.querySelector('#strip'); return 'strip 1440: scroll ' + s.scrollWidth + ' / client ' + s.clientWidth; })()"
ab set viewport 1280 800; sleep 0.6
js "(() => { const s = document.querySelector('#strip'); return 'strip 1280: scroll ' + s.scrollWidth + ' / client ' + s.clientWidth; })()"
ab screenshot "$R"/p-02-strip-1280.png
ab set viewport 1440 900

echo "== truth frame wording while facing the round wall (settled camera, 360°)"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { const { S, A, ctx } = __me; A.select('gwin'); A.face('gwin'); await new Promise(r => setTimeout(r, 400)); return 'flat=' + ctx.stage.cam.flat.toFixed(2) + ' truth=' + document.querySelector('#truthK').textContent + ' | scale bar shown: ' + document.querySelector('#stage').classList.contains('true-measure'); })()"
ab screenshot "$R"/p-03-face-360.png

echo "== chained open states: 3D -> section -> face its door's wall -> Esc"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { const { S, A } = __me; const w = () => new Promise(r => setTimeout(r, 300)); A.startKnife(); await w(); A.presetKnife([-17,0.25],[13,0.25],-1,6); A.commitKnife(); await w(); A.setDepth(3); A.select('gdoor'); A.face('gdoor'); await w(); const mid = S.session.kind + ' (origin: ' + S.session.origin.label + ')'; A.closeSession(); await w(); return 'in: ' + mid + ' -> Esc lands in: ' + (S.session ? S.session.kind : 'no open state, view=' + A.viewLabel()); })()"

echo "== exact restoration through the trail"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { const { S, A, ctx } = __me; const w = () => new Promise(r => setTimeout(r, 300)); A.startKnife(); await w(); A.presetKnife([-17,0.25],[13,0.25],-1,6); A.commitKnife(); await w(); A.setDepth(3); A.select('harbor'); A.toggleReveal('harbor'); const c = ctx.stage.cam; c.az += 0.05; c.frameH *= 0.8; A.pushTrail('Section tweaked'); const before = { az: c.az.toFixed(3), fh: c.frameH.toFixed(2), depth: S.session.cut.depth, reveal: S.reveal }; A.go3D(); await w(); A.trailStep(-1); await w(); await w(); const c2 = ctx.stage.cam; const after = { az: c2.az.toFixed(3), fh: c2.frameH.toFixed(2), depth: S.session?.cut.depth, reveal: S.reveal }; return JSON.stringify({ before, after }); })()"
