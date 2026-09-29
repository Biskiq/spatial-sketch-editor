#!/usr/bin/env bash
# Re-measures the audit after the revision, plus the new flows.
R="$(cd "$(dirname "$0")" && pwd)"
export AGENT_BROWSER_SESSION=p26review
ab() { agent-browser "$@" >/dev/null; }
js() { agent-browser eval "$1"; }
wait_idle="while (__me.S.busy) await new Promise(r => setTimeout(r, 30));"
ab set viewport 1440 900

echo "== O on the Rotunda wall: time to an editable sheet (first time, adaptive)"
ab open "http://localhost:8826/index.html?shot=1"; sleep 2.5
js "(async () => { const { S, A } = __me; A.select('rotunda'); const t0 = performance.now(); A.unfold(); await new Promise(r => setTimeout(r, 50)); $wait_idle return 'first: ' + Math.round(performance.now() - t0) + ' ms, view: ' + A.viewLabel(); })()"
js "(async () => { const { S, A } = __me; A.closeSession(); await new Promise(r => setTimeout(r, 50)); $wait_idle A.closeSession(); await new Promise(r => setTimeout(r, 50)); $wait_idle A.select('rotunda'); A.unfold(); await new Promise(r => setTimeout(r, 50)); $wait_idle A.closeSession(); await new Promise(r => setTimeout(r, 50)); $wait_idle A.select('rotunda'); const t0 = performance.now(); A.unfold(); await new Promise(r => setTimeout(r, 50)); $wait_idle return 'third: ' + Math.round(performance.now() - t0) + ' ms'; })()"
js "(() => { const s = document.querySelector('#strip'); return 'strip 1440: scroll ' + s.scrollWidth + ' / client ' + s.clientWidth; })()"
ab screenshot "$R/n-10-flat-1440.png"
ab set viewport 1280 800; sleep 0.8
js "(() => { const s = document.querySelector('#strip'); return 'strip 1280: scroll ' + s.scrollWidth + ' / client ' + s.clientWidth; })()"
ab screenshot "$R/n-11-flat-1280.png"
ab set viewport 1440 900

echo "== peel by hand from 3D, stop part-way"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(() => { __me.A.select('rotunda'); return 1; })()" >/dev/null; sleep 0.5
P=$(js "(() => { const r = document.querySelector('[data-peel]').getBoundingClientRect(); return Math.round(r.x + 8) + ',' + Math.round(r.y + 8); })()" | tr -d '"'); X=${P%,*}; Y=${P#*,}
ab mouse move $X $Y; ab mouse down left; ab mouse move $((X-40)) $((Y+30)); ab mouse move $((X-110)) $((Y+90)); sleep 0.3
ab screenshot "$R/n-12-peel-mid.png"
ab mouse up left; sleep 0.4
js "(() => { const s = __me.S.session; return 'after peel: ' + __me.A.viewLabel() + ' side=' + s.side + ' u=' + s.u.toFixed(2) + ' handles=' + [...document.querySelectorAll('#ovHtml [data-h]')].length + ' gated=' + __me.S.gated.length; })()"
ab screenshot "$R/n-13-peeled.png"
js "(async () => { __me.A.setSide(1); await new Promise(r => setTimeout(r, 400)); return 'after Inside: ' + __me.A.viewLabel(); })()"
ab screenshot "$R/n-14-peeled-inside.png"
ab press Escape; sleep 0.5
js "(() => 'after Esc: ' + __me.A.viewLabel() + ' session=' + !!__me.S.session)()"

echo "== nested: section -> go to a beyond item's wall -> Esc -> back in the section, same depth"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { const { S, A } = __me; const w = () => new Promise(r => setTimeout(r, 250)); A.startKnife(); await w(); A.presetKnife([-17,0.25],[13,0.25],-1,6); A.commitKnife(); await w(); A.setDepth(3); A.select('harbor'); await w(); return 'member: ' + JSON.stringify(A.memberOf('harbor')); })()"
ab screenshot "$R/n-15-beyond.png"
js "(async () => { const { S, A } = __me; A.goToHost('harbor'); await new Promise(r => setTimeout(r, 400)); return 'in: ' + A.viewLabel() + ' | crumbs: ' + A.crumbs().map(c => c.label).join(' > '); })()"
ab screenshot "$R/n-16-nested-face.png"
ab press Escape; sleep 0.6
js "(() => { const s = __me.S.session; return 'Esc -> ' + __me.A.viewLabel() + ' depth=' + (s && s.cut && s.cut.depth); })()"
js "(async () => { const { S, A } = __me; A.includeIt('harbor'); await new Promise(r => setTimeout(r, 100)); return 'include -> depth ' + S.session.cut.depth + ' member ' + A.memberOf('harbor').state; })()"
ab screenshot "$R/n-17-included.png"

echo "== exact restore through the trail"
js "(async () => { const { S, A, ctx } = __me; const w = () => new Promise(r => setTimeout(r, 300)); A.setDepth(3); A.toggleReveal('harbor'); const c = ctx.stage.cam; c.az += 0.05; c.frameH *= 0.8; A.pushTrail('Section tweaked'); const before = { az: c.az.toFixed(3), fh: c.frameH.toFixed(2), depth: S.session.cut.depth, reveal: S.reveal }; A.go3D(); await w(); A.trailStep(-1); await w(); await w(); const c2 = ctx.stage.cam; return JSON.stringify({ before, after: { az: c2.az.toFixed(3), fh: c2.frameH.toFixed(2), depth: S.session && S.session.cut.depth, reveal: S.reveal } }); })()"

echo "== find: a painting behind a wall, from the overview"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
ab press /; sleep 0.2; ab type "#finderInput" "tide"; sleep 0.3
ab screenshot "$R/n-18-finder.png"
js "(() => [...document.querySelectorAll('#finderList li')].map(l => l.textContent).join(' | '))()"
ab press Enter; sleep 0.5
js "(() => JSON.stringify(__me.A.whereIs(__me.S.sel)))()"
ab screenshot "$R/n-19-find-behind.png"

echo "== knife slide: the preview follows"
ab open "http://localhost:8826/index.html?shot=1&motion=instant"; sleep 2.5
js "(async () => { const { A } = __me; A.goPlan(); await new Promise(r => setTimeout(r, 300)); A.startKnife(); await new Promise(r => setTimeout(r, 200)); A.presetKnife([-17,0.25],[13,0.25],-1,6); return 1; })()" >/dev/null; sleep 0.6
P=$(js "(() => { const r = document.querySelector('[data-h=\"kn-slide\"]').getBoundingClientRect(); return Math.round(r.x + r.width/2) + ',' + Math.round(r.y + r.height/2); })()" | tr -d '"'); X=${P%,*}; Y=${P#*,}
js "(() => 'crosses before: ' + document.querySelector('#ovHtml') .innerText.match(/crosses[^\n]*/)[0])()"
ab mouse move $X $Y; ab mouse down left; ab mouse move $X $((Y-40)); ab mouse move $X $((Y-70)); ab mouse up left; sleep 0.5
js "(() => 'after slide: p0=' + __me.S.knife.p0.map(v => v.toFixed(2)) + ' ' + document.querySelector('#ovHtml').innerText.match(/crosses[^\n]*/)[0])()"
ab screenshot "$R/n-20-knife-slid.png"
