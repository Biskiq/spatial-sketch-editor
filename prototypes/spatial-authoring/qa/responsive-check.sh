#!/usr/bin/env bash
# S7: only responsive projection, keyboard gaps and live reduced motion; earlier axes own A–F.
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT="${QA_SHOT:-0}"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear

# Assertions run in the page in blocks; a failed block returns its reason and fails this script.
install_helpers() { qa_js "$(cat <<'JS'
window.s7 = (() => {
  const { A, S, qa: q, ctx } = __me;
  const el = (s) => document.querySelector(s);
  const check = (ok, reason) => { if (!ok) throw Error(reason); };
  const near = (a, b) => Math.abs(a - b) < 0.002;
  const pose = () => { const { aspect, ...r } = q.realized(); return JSON.stringify(r); };
  const source = () => q.hash() + '/' + S.undo.length;
  const key = (key) => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const settle = async () => { await Promise.resolve(); await q.idle(); await q.render(); };
  return { A, S, q, ctx, el, check, near, pose, source, key, settle };
})()
JS
)" >/dev/null; }
install_helpers
block() {
  local result
  result="$(qa_jsv "(async () => { const { A,S,q,ctx,el,check,near,pose,source,key,settle } = s7; try { $2; await settle(); return 'ok'; } catch(e) { return String(e.message); } })()")"
  qa_ok "$1" "$result" "ok"
}

block 'initial ordinary pose' 'A.select("gwin"); await settle(); s7.startPose = pose(); s7.startSource = source();'
for spec in '1440 900 1' '1280 800 1' '1024 768 1' '1024 768 2'; do
  read -r w h dpr <<<"$spec"
  agent-browser set viewport "$w" "$h" "$dpr" >/dev/null
  block "${w}×${h} DPR${dpr}: canvas, picking and unchanged pose" '
    await new Promise(r => setTimeout(r, 80)); await settle();
    const r = el("#stage").getBoundingClientRect(), c = el("#gl").getBoundingClientRect();
    check(near(r.width,c.width) && near(r.height,c.height) && near(r.x,c.x) && near(r.y,c.y), "canvas alignment");
    check(el("#gl").width === Math.round(c.width * Math.min(devicePixelRatio,2)), "DPR buffer");
    check(near(ctx.stage.camera.aspect,c.width/c.height), "aspect");
    const hit = ctx.stage.pick(c.x+c.width/2,c.y+c.height/2);
    check(hit, "no centre hit");
    const p = ctx.stage.project(hit.point), again = ctx.stage.pick(c.x+p.x,c.y+p.y);
    check(again?.object.userData.id === hit.object.userData.id, "projection/picking disagree");
    check(pose() === s7.startPose && source() === s7.startSource, "resize changed standpoint/source");
    const narrow = innerWidth <= 1060;
    check((getComputedStyle(el("#index")).display === "none") === narrow, "Index exposure");
    check((getComputedStyle(el("[data-act=sheet-card]")).display !== "none") === narrow, "sheet exposure");'
  qa_snap "responsive-$w-$dpr"
done
agent-browser set viewport 1024 768 1 >/dev/null
block 'return to normal device scale for keyboard work' 'await new Promise(r => setTimeout(r,80)); await settle();'

# Real keyboard activation and focus handoff through the shell.
agent-browser focus '[data-act="sheet-card"]' >/dev/null
qa_press Enter
block 'Card sheet focuses inside and preserves reading/pose' '
  check(S.sheet.card && el("#card").contains(document.activeElement), "sheet focus");
  check(pose() === s7.startPose && source() === s7.startSource, "sheet moved Camera/source");'
qa_key_dispatch Escape
block 'sheet Esc restores its trigger, keeping selection' '
  check(!S.sheet.card && document.activeElement.dataset.act === "sheet-card" && S.sel === "gwin", "sheet return");'

block 'keyboard line: seed, slide, turn, depth, cancel without edits' '
  el("#gl").focus(); key("k"); await settle(); key("ArrowRight"); await settle();
  const k = S.knife, len = () => Math.hypot(k.p1[0]-k.p0[0],k.p1[1]-k.p0[1]);
  check(k?.p1, "no keyboard line"); const l = len(), mid = () => [(k.p0[0]+k.p1[0])/2,(k.p0[1]+k.p1[1])/2], m = mid();
  key("ArrowRight"); check(near(Math.hypot(mid()[0]-m[0],mid()[1]-m[1]),0.5), "slide");
  const n = mid(); key("ArrowUp"); check(near(len(),l) && near(mid()[0],n[0]) && near(mid()[1],n[1]), "turn");
  key("-"); check(k.depth === 5.5, "depth"); key("Escape"); await settle();
  check(!S.knife && !S.task && source() === s7.startSource, "aim cancellation");'
block 'numeric refusal announces, retains value and field focus; shortcuts respect writer' '
  el("#gl").focus(); await A.face("gwin"); await settle(); key("p"); await settle();
  const box=el("#instrument").getBoundingClientRect();
  check([...el("#instrument .st-row").querySelectorAll("button,input")].every(b=>{const r=b.getBoundingClientRect();return r.left>=box.left && r.right<=box.right && r.bottom<=box.bottom;}),"clipped Instrument control");
  let f = el("#precision input[data-field]"); check(f, "no numeric access"); f.focus();
  s7.beforeWrite = source(); f.value = "-4"; key("Enter"); await settle();
  check(source() === s7.beforeWrite && el("[aria-invalid=true]") && el("#announcer").textContent, "refusal/history/announcement");
  check(document.activeElement.dataset.field === f.dataset.field, "lost field focus");
  key("1"); key("f"); check(S.session?.kind === "face" && S.task.precision, "shortcut stole input");
  el("#gl").focus(); key("Escape"); await settle(); key("Escape"); await settle();
  check(!S.session && !S.task && S.sel === "gwin", "keyboard unwind");'

# Media changes exercise the browser preference, not a stub of matchMedia.
agent-browser set viewport 1440 900 >/dev/null
agent-browser set media light reduced-motion >/dev/null
QA_QUERY='shot=1&motion=brisk'
qa_open
install_helpers
block 'OS preference at boot: reduced motion without changing speed' '
  check(q.state().reduced && S.osReduced && !S.reduceMotion && S.motion === "brisk", "boot preference");
  A.select("gwin"); await A.face("gwin"); await settle(); s7.reducedPose = pose();
  check(el("#caption").hidden, "reduced caption"); await A.closeAll(); await settle();'
# The emulated media change reaches the page asynchronously, so poll the state it drives instead of
# sleeping a fixed span that a loaded machine can outrun.
agent-browser set media light no-preference >/dev/null
block 'live OS change: normal travel reaches identical endpoint' '
  for (let i = 0; i < 100 && (q.state().reduced || S.osReduced); i++) await new Promise(r => setTimeout(r, 50));
  check(!q.state().reduced && !S.osReduced, "live preference");
  await A.face("gwin"); await settle(); check(pose() === s7.reducedPose, "different endpoint");'
agent-browser set media light reduced-motion >/dev/null
block 'user override preserves OS preference and motion speed' '
  for (let i = 0; i < 100 && !S.osReduced; i++) await new Promise(r => setTimeout(r, 50));
  el("#motionBtn").click(); el("#motionBtn").click(); await settle();
  check(q.state().reduced && !S.reduceMotion && S.motion === "brisk", "override canceled OS/speed");'
qa_faults_ok 'no command or page faults'
qa_browser_errors_ok 'no browser errors'
qa_summary 'S7 responsive and keyboard'
