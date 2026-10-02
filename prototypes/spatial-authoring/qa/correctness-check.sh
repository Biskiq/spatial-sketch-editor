#!/usr/bin/env bash
# Remaining numerical and parking obligations; existing axes own shell entry and real gestures.
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT="${QA_SHOT:-0}"
source "$QA_DIR/lib.sh"
qa_open
result="$(qa_jsv "$(cat <<'JS'
(async () => {
  const { A, S, ctx, qa:q } = __me, m = await import('./app/model.js');
  const check = (b, why) => { if (!b) throw Error(why); };
  const near = (a,b) => Math.abs(a-b) < .002;
  const source = () => q.hash() + '/' + S.undo.length;
  const pose = () => { const {aspect,mirror,...r} = q.realized(); return JSON.stringify(r); };
  try {
    // Profiles, seam and source validators beyond the presenter inventory.
    const w = m.createMuseum().walls.find(w => w.id === 'rotunda'), o = w.openings.find(o => o.id === 'gwin');
    for (const profile of ['round','pointed','rect']) {
      const p = {...o,profile};
      check(near(m.openingTopAt(p,p.s),p.head), profile+' head');
      check(!m.validateOpening(w,p), profile+' rejected');
    }
    w.top = {form:'gable',h0:6,h1:6,rs:10,rh:7.2};
    check(!m.validateWall(w) && near(m.topAt(w,0),m.topAt(w,m.wallLength(w))), 'gable seam');
    w.top.h1 = 5; check(m.validateWall(w), 'broken seam accepted');
    const line = m.createMuseum().walls.find(w => w.id === 'north');
    line.top = {form:'slope',h0:4,h1:4.8}; check(!m.validateWall(line), 'legal slope');
    line.top.h0 = 1; check(m.validateWall(line), 'invalid slope accepted');
    const ceiling = m.createMuseum().ceilings[0]; ceiling.plane.gx = .5;
    check(m.validateCeiling(ceiling), 'ceiling slope accepted');
    A.select('longc'); await A.lift('longc'); await q.render(); const gapSource = source();
    const gap = document.querySelector('[data-gap="north"]'); check(gap,'missing gap entry'); gap.click(); await q.render();
    check(S.sel === 'longc','relation warning substituted selection');
    const option = document.querySelector('[data-opt="1"]'); option.focus(); await q.render();
    check(S.preview && S.undo.length === 0,'keyboard preview missing or committed');
    option.blur(); await q.render(); check(!S.preview && source() === gapSource,'keyboard preview did not cancel');
    option.focus(); await q.render(); await A.closeAll(); await q.render();
    check(!S.preview && source() === gapSource,'return accepted a preview');
    A.select('gwin'); const start = source();
    A.editOnce('no-op', () => A.applyOpening('gwin',{head:3.4})); check(source() === start,'no-op history');
    await A.face('gwin'); A.editOnce('rise', () => A.applyOpening('gwin',{rise:.45})); await A.closeAll(); await q.render();
    const eye = pose(); A.select('bench'); A.undoSummary(); await q.render();
    check(q.hash() === start.split('/')[0] && pose() === eye && S.sel === 'gwin','summary Undo source/selection/Camera');
    A.redo(); await q.render(); check(S.sel === 'bench' && pose() === eye,'Redo selection/Camera'); A.undo();
    // Every inactive chain must resume from the crossing standpoint and unwind to that new root.
    for (const kind of ['section','lookup','dims']) {
      await A.closeAll(); A.endTaskInHand(); A.dismissParked(); A.select(kind === 'lookup' ? 'longc' : 'gwin');
      if (kind === 'section') {
        A.startKnife(); await q.idle(); await q.render(); A.presetKnife([-17,.25],[13,.25],-1,6); await A.commitKnife();
        A.setDepth(3); A.toggleReveal('harbor'); await A.face('gwin');
      } else if (kind === 'lookup') { await A.lift('longc'); await A.lookUp('longc'); A.toggleMirror(); }
      else { A.dimensionTask('gwin'); A.setPrecision(true); await q.render(); const f=document.querySelector("#precision input"); f.value="-4"; f.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); check(S.fieldErr,"missing numerical refusal"); }
      await q.render(); const prior = pose(), accepted = source();
      document.querySelector('[data-act=lens][data-lens=experience]').click(); await q.idle(); await q.render();
      check(!S.session && !S.task && !S.preview && !S.knife && !S.fieldErr && source() === accepted && pose() === prior, kind+' park');
      ctx.stage.cam.az += .12; ctx.stage.cam.target.x += 1; await q.render(); const fresh = pose();
      document.querySelector('[data-act=lens][data-lens=world]').click(); await q.render();
      check(!S.session && !S.task && pose() === fresh, kind+' automatic revival');
      document.querySelector('#card [data-act=resume]').click(); await q.idle(); await q.render();
      check(S.task && !document.querySelector('#instrument').hidden, kind+' missing resumed Instrument');
      if (kind === 'section') { check(S.session.parent?.kind === 'section', 'lost parent'); await A.closeSession(); check(S.session.cut.depth === 3 && S.reveal === 'harbor','parent params'); }
      if (kind === 'lookup') check(ctx.stage.cam.mirror, 'lost mirror');
      await A.closeAll(); A.endTaskInHand(); await q.render();
      check(pose() === fresh && source() === accepted, kind+' reused old return root');
    }
    A.select(null); A.startKnife(); await q.idle(); await q.render();
    A.presetKnife([-17,.25],[13,.25],-1,6); await A.commitKnife(); await q.render();
    A.switchLens('experience'); A.switchLens('world'); await q.render();
    check(S.parked.identity === null, 'location task fabricated an identity');
    S.parked.chain[0].cut.depth = -1; await A.resumeParked(); await q.render();
    check(!S.session && !S.task && !A.parkedContext().ok, 'invalid Section resumed');
    S.parked.chain[0].cut.depth = 6; A.select('bench');
    check(!A.parkedContext().ok, 'changed location context silently adopted selection');
    return 'ok';
  } catch(e) { return e.message; }
})()
JS
)")"
qa_ok 'profiles, validators, summary history and nested parking' "$result" 'ok'
qa_js '(async () => { await __me.A.closeAll(); __me.A.endTaskInHand(); __me.A.select("panel"); await __me.qa.render(); return true; })()' >/dev/null
before="$(qa_jsv '__me.qa.hash()+"/"+__me.S.undo.length')"
agent-browser focus '#card [data-act="look-repair"]' >/dev/null
qa_press Enter
agent-browser focus '#instrument [data-act="repair-pick"][data-id="south"]' >/dev/null
qa_press Enter
qa_ok 'keyboard invokes Repair and explicit wall preview' "$(qa_js '__me.S.task?.kind === "repair" && __me.S.task.params.wall === "south" && !!__me.ctx.stage.previewPlace')" true
qa_key_dispatch Escape
qa_ok 'keyboard repair cancel leaves source unchanged' "$(qa_jsv '__me.qa.hash()+"/"+__me.S.undo.length')" "$before"
qa_js '(async () => { await __me.A.closeAll(); __me.A.endTaskInHand(); __me.A.select("gwin"); await __me.A.face("gwin"); await __me.qa.render(); return true; })()' >/dev/null
before="$(qa_jsv '__me.qa.hash()+"/"+__me.S.undo.length')"
p="$(qa_at '[data-h="h-head"]')"; x="${p%,*}"; y="${p#*,}"
qa_move "$x" "$y"; qa_down; qa_move "$x" "$((y-35))"
qa_js '__me.A.select("bench")' >/dev/null
qa_up
qa_frames
qa_ok 'changing selection cancels a live candidate before late release' "$(qa_jsv '__me.qa.hash()+"/"+__me.S.undo.length')" "$before"
qa_js '(async () => { __me.A.select("gwin"); await __me.qa.render(); return true; })()' >/dev/null
p="$(qa_at '[data-h="h-head"]')"; x="${p%,*}"; y="${p#*,}"
qa_move "$x" "$y"; qa_down; qa_move "$x" "$((y-35))"
qa_ok 'real drag holds a candidate before crossing' "$(qa_js '!!__me.S.pending')" true
qa_js '__me.A.switchLens("experience")' >/dev/null
qa_up
qa_frames
qa_ok 'lens crossing cancels drag; late release cannot commit' "$(qa_jsv '__me.qa.hash()+"/"+__me.S.undo.length')" "$before"
qa_ok 'crossing leaves no writer or hidden Instrument' "$(qa_js '!__me.S.pending && !__me.S.session && !__me.S.task && document.querySelector("#instrument").hidden')" true
agent-browser focus '[data-act="lens"][data-lens="world"]' >/dev/null
qa_press Enter
agent-browser focus '#card [data-act="resume"]' >/dev/null
qa_press Enter
qa_ok 'keyboard Resume reactivates reading and Instrument' "$(qa_js '!!__me.S.session && !!__me.S.task && !document.querySelector("#instrument").hidden')" true
qa_js '(async () => { await __me.JOURNEYS[0].steps[0].run(); await __me.qa.render(); return true; })()' >/dev/null
qa_ok 'presenter resets lens, parked work, sheets and disclosure' "$(qa_js '__me.S.lens === "world" && !__me.S.parked && !__me.S.task && !__me.S.flatHold && !__me.S.sheet.card && !__me.S.sheet.index && document.querySelector("#finder").hidden')" true
qa_faults_ok 'no command or page faults'
qa_browser_errors_ok 'no browser errors'
qa_summary 'Numerical and nested correctness'
