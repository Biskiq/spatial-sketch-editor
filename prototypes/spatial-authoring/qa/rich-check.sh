#!/usr/bin/env bash
# C9.7 product axis: the loaded rich example and its exercised local coordination (J4–J8/J10).
#   * the example carries the repeated occurrence, the off-Guide Wall assembly, the no-View atmosphere
#     moment and one authored Travel Seam — immediately reviewable, nothing built first;
#   * the Wall assembly is the World's own representation subject: Preview unrolls the authored Wall
#     through its evaluator, and Exit restores the author's reading exactly with source/history frozen;
#   * the Seam's local strip shows the Camera route, its named station and both Experience rows, with
#     stable station identity, an editable Experience hold and Camera-owned pace/anchor writers;
#   * Preview executes only the traversed route, exactly once, and a rebound invocation is an explicit
#     local refusal rather than a silent double run.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open;qa_faults_clear
click(){ agent-browser scrollintoview "$1" >/dev/null;agent-browser click "$1" >/dev/null;qa_frames; }
choose(){ agent-browser select "$1" "$2" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null;qa_press Enter; }
# A visitor choice is addressed by its authored label, never by being the first enumerated control.
byText(){ qa_js "(()=>{const b=[...document.querySelectorAll(\"$1\")].find(e=>e.textContent.trim()===\"$2\");if(!b)return false;b.click();return true;})()" >/dev/null;qa_frames; }
fixture(){ click '#experienceExamples > summary';click "[data-act='$1']";click '#experienceExamples > summary'; }
# A control inside a scrolling Card can sit under the fixed status footer; the product's own click
# handler is still the one exercised, dispatched on the element itself.
press(){ qa_js "(()=>{const e=document.querySelector(\"$1\");if(!e)return false;e.click();return true;})()" >/dev/null;qa_frames; }
# Preview returns to the ordinary deck, so seam-scoped controls are reached through the Guide again.
openseam(){ click '#experienceDeck [data-act=exp-guide]';click "[data-act='exp-seam'][data-from='$first'][data-to='$second']"; }
# A mutation stops at the first boundary it protects, so later unrelated state cannot mask it.
checkpoint(){ if [ "${QA_RICH_UNTIL:-}" = "$1" ];then qa_summary "C9.7 boundary $1";exit;fi; }
undo(){ qa_jsv '__me.S.undo.length'; }
hash(){ qa_jsv '__me.qa.hash()'; }

# ---- The loaded example is the donor adaptation, and it is reviewable as loaded.
click '#lens [data-lens=experience]';fixture exp-example
first="$(qa_jsv '__me.ctx.experience.guide[0]')";second="$(qa_jsv '__me.ctx.experience.guide[1]')"
qa_ok 'the example is a three-Stop Guide with a repeated occurrence, a no-View Atmosphere moment and one authored Seam' "$(qa_js '(()=>{const e=__me.ctx.experience,ps=Object.values(e.presentations);return e.guide.length===3&&ps.length>=4&&ps.filter(p=>p.uses.length===0).length===1&&Object.keys(e.seams).length===1;})()')" true
qa_ok 'its Seam carries a route, an interior hold and one station-only invocation' "$(qa_js '(()=>{const e=__me.ctx.experience,s=Object.values(e.seams)[0],i=s.beats.find(b=>b.kind==="invoke"),h=s.beats.find(b=>b.kind==="hold"),w=e.uses[i?.useId];return !!i&&!!h&&h.seconds>0&&s.mode==="travel"&&!!w&&w.start.kind==="station"&&w.start.stationId===i.stationId&&w.start.connectionId===i.connectionId;})()')" true
station_use="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(x=>x.start&&x.start.kind==="station").id')"
qa_ok 'the Wall assembly is the World representation subject, not fabricated Scene geometry' "$(qa_js '(()=>{const s=__me.ctx.sceneSource.subjects.wallAssembly;return s.profile==="representation"&&s.wallId==="rotunda"&&!Object.keys(s.properties).some(k=>k!=="unfolded");})()')" true
checkpoint fixture

# ---- The native Wall adapter: Preview moves the authored Wall, Exit puts it back.
unfold_use="$(qa_jsv '(()=>{const e=__me.ctx.experience,u=Object.values(e.uses).find(x=>e.definitions[x.definitionId]?.capabilityId==="unfold"&&e.definitions[x.definitionId].subjectId==="wallAssembly");return u?u.id:"";})()')"
wall_stop="$(qa_jsv '(()=>{const e=__me.ctx.experience;for(const s of Object.values(e.stops)){const c=s.choices.find(c=>c.label==="See the wall assembly");if(c)return c.targetId;}return "";})()')"
reading_before="$(qa_jsv '__me.ctx.stage.d("rotunda").u')"
source_before="$(hash)";count_before="$(undo)"
wall_entry_use="$(qa_jsv '(()=>{const e=__me.ctx.experience;for(const s of Object.values(e.stops)){const c=s.choices.find(c=>c.label==="See the wall assembly");if(c){const st=e.stops[c.targetId];return st&&st.entry.kind==="presentation"?(Object.values(e.uses).find(u=>u.presentationId===st.presentationId&&u.viewId&&u.role==="entry")?.id||""):"";}}return "";})()')"
click '#experienceDeck [data-act=exp-preview-guide]'
byText '[data-command=detour]' 'See the wall assembly'
qa_ok 'the off-Guide Wall assembly is a deliberate visitor entry whose transient invocation runs there' "$(qa_js "(()=>{const r=__me.S.visitor.runtime;return r.stopId==='$wall_stop'&&!!r.active['$unfold_use']&&!!document.querySelector('[data-command=return]')&&!!r.overrides.wallAssembly;})()")" true
qa_ok 'the Wall detour arrives through the Wall entry View, so the unroll happens in view' "$(qa_js "__me.S.visitor.runtime.arrivedViewUseId==='$wall_entry_use'")" true
qa_js '(async()=>{await new Promise(r=>setTimeout(r,1500));await __me.qa.render();return true;})()' >/dev/null
qa_ok 'Preview unrolls the authored World Wall through its own evaluator' "$(qa_js '(()=>{const u=__me.ctx.stage.d("rotunda").u,o=__me.S.visitor.runtime.overrides.wallAssembly;return u>0.9&&!!o&&o.unfolded.value>0.9;})()')" true
qa_ok 'the unroll writes no source and no history' "$(hash) / $(undo)" "$source_before / $count_before"
click '[data-act=exp-exit-preview]'
qa_ok 'Exit restores the author Wall reading exactly and clears the visitor session' "$(qa_jsv '__me.ctx.stage.d("rotunda").u') / $(qa_js '!__me.S.visitor') / $(hash) / $(undo)" "$reading_before / true / $source_before / $count_before"
checkpoint wall

# ---- The loaded Seam's local coordination is reviewable without building a timeline.
click '#experienceDeck [data-act=exp-guide]'
click "[data-act='exp-seam'][data-from='$first'][data-to='$second']"
click '[data-act=exp-coordinate]'
qa_ok 'the strip opens on the loaded route with its named station and both Experience rows' "$(qa_js '(()=>{const t=document.querySelector(".coordination-strip"),s=Object.values(__me.ctx.experience.seams)[0];return !!t&&t.textContent.includes("Power station")&&document.querySelectorAll(".coord-beat").length===s.beats.filter(b=>b.kind==="invoke").length&&!!document.querySelector(".coord-hold")&&document.querySelector("[data-hold-duration]").getBoundingClientRect().width>20;})()')" true
hold="$(qa_jsv 'Object.values(__me.ctx.experience.seams)[0].beats.find(b=>b.kind==="hold").id')"
station="$(qa_jsv 'Object.values(__me.ctx.experience.seams)[0].beats.find(b=>b.kind==="invoke").stationId')"
identity="$(qa_js '__me.S.sel')"
click ".station-tick[data-id='$station']"
qa_ok 'selecting the named station focuses its own counterpart and keeps the canonical Stop selection' "$(qa_js '__me.S.sel') / $(qa_js "(__me.S.task.params.station==='$station'&&!!document.querySelector(\"[data-station-counterpart='$station']\")&&document.querySelector('#experienceDeck').textContent.includes('Power station'))")" "$identity / true"
# Focusing the Hold is a distinct event focus: it addresses that Hold own station, not the invocation
# selected a moment earlier, while the canonical Stop selection is untouched.
hold_station="$(qa_jsv "Object.values(__me.ctx.experience.seams)[0].beats.find(x=>x.id==='$hold').stationId")"
qa_js "(window.__holdId='$hold',window.__holdStation='$hold_station',window.__identity='$(qa_jsv '__me.S.sel')')" >/dev/null
qa_js '(()=>{const el=document.querySelector("[data-exp-hold="+JSON.stringify(window.__holdId)+"]");if(!el)return false;el.focus();return true;})()' >/dev/null;qa_frames
# The focused Hold is the whole coordination reading: its own station replaces the one selected a moment
# earlier, and the field the author entered keeps the keyboard because the rerender replaces its markup.
qa_ok 'focusing the Hold moves the coordination focus to that Hold own station and event' "$(qa_js '(()=>{const t=__me.S.task,strip=document.querySelector(".coordination-strip"),frame=document.querySelector("[data-exp-hold="+JSON.stringify(window.__holdId)+"]"),hold=strip&&strip.querySelector(".coord-hold[data-beat="+JSON.stringify(window.__holdId)+"]");return t.params.beat===window.__holdId&&t.params.station===window.__holdStation&&!!hold&&hold.classList.contains("active")&&strip.querySelectorAll(".coord-beat.active").length===0&&strip.querySelector("[data-exp-station]").value===window.__holdStation&&__me.S.sel===window.__identity&&document.activeElement===frame;})()')" true
checkpoint review

# ---- Duration is an Experience writer; pace and geometry stay Camera's.
camera_before="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
hold_seconds="$(qa_js "Object.values(__me.ctx.experience.seams)[0].beats.find(x=>x.id==='$hold').seconds")"
undo_reject="$(undo)"
# A rejected value is refused, and correcting it in the same field still commits: the guard must not keep
# comparing a refreshed attempt against the rejected one's epoch.
fill "[data-exp-hold='$hold']" '-1'
qa_ok 'a rejected Hold value is refused without writing source or history' "$(qa_js "Object.values(__me.ctx.experience.seams)[0].beats.find(x=>x.id==='$hold').seconds") / $(undo)" "$hold_seconds / $undo_reject"
count_before="$(undo)"
fill "[data-exp-hold='$hold']" '3'
qa_ok 'editing the Hold duration is one Experience Undo and never a Camera edit' "$(qa_js "Object.values(__me.ctx.experience.seams)[0].beats.find(x=>x.id==='$hold').seconds") / $(undo) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_jsv '__me.S.undo.at(-1).label')" "3 / $((count_before+1)) / $camera_before / Edit Experience station hold"
beats_refs="$(qa_js 'JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats)')"
timing_before="$(qa_js 'document.querySelector(".coord-hold").textContent')"
route="$(qa_jsv '__me.S.task.params.connection')"
choose '[data-exp-pace]' slow
qa_ok 'Camera pace remains Camera source, with the Experience beats unchanged' "$(qa_js "JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats)") / $(qa_js "(__me.ctx.cameraSource.connections['$route'].speed==='slow'&&document.querySelector('.coord-hold').textContent!==$timing_before)")" "$beats_refs / true"
# Merely seeing coordination is not arming a route writer: the press must land on the drawing itself.
# Dynamic values are published to a page global first: a double-quoted argument carrying {a,b} is
# brace-expanded by this shell into several words, which silently compares fragments instead.
qa_js "window.__route='$route'" >/dev/null
qa_js "window.__anchors=__me.ctx.cameraSource.connections['$route'].anchors.length" >/dev/null
stage="$(qa_jsv '(()=>{const c=document.querySelector("#stage canvas");const r=c.getBoundingClientRect();return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height*.28);})()')"
qa_move "${stage%,*}" "${stage#*,}";qa_down;qa_up
qa_ok 'a Stage press while coordination is merely visible shows no Camera anchor' "$(qa_js '(()=>{const c=document.querySelector("#stage canvas");const r=c.getBoundingClientRect();const x=Math.round(r.x+r.width/2);const y=Math.round(r.y+r.height*.28);return document.elementFromPoint(x,y)===c&&__me.ctx.cameraSource.connections[window.__route].anchors.length===window.__anchors;})()')" true
# Geometry is edited on Stage, through the deliberately armed route writer, with stable references.
anchor="$(qa_jsv "(()=>{const r=__me.ctx.cameraSource.connections['$route'];return r.anchors[0]?.id||'';})()")"
count_before="$(undo)"
click "[data-act='exp-route'][data-id='$route']"
qa_drag "[data-exp-anchor=\"$anchor\"]" 25 10
qa_ok 'an accepted Stage anchor drag is one Camera Undo with stable Experience references' "$(undo) / $(qa_js 'JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats)')" "$((count_before+1)) / $beats_refs"
click '#undoBtn'
click '[data-act=exp-route-return]';click '[data-act=exp-close]'
checkpoint writers

# ---- Preview executes the traversed route only, once, at its own station.
click '#experienceDeck [data-act=exp-preview-guide]'
qa_js "window.__stationUse='$station_use'" >/dev/null
click '[data-command=next]'
qa_ok 'the destination visit does not arm the station-only Activity on entry' "$(qa_js '(()=>{const v=__me.S.visitor;const r=v.runtime;const armed=r.active[window.__stationUse];return armed===undefined&&Object.values(r.activities).filter(a=>v.source.experience.uses[a.useId].start.kind==="station").length===0;})()')" true
qa_ok 'Next travels the authored route, carrying its hold and its station invocation' "$(qa_js '(()=>{const m=__me.S.visitor.runtime.movement;return !!m&&m.invokes.length===1&&m.holds.length===1&&Math.abs(m.duration-m.travelDuration-3)<.001;})()')" true
qa_js '__me.E.stepVisitor(6)' >/dev/null;qa_frames
qa_ok 'the invocation ran exactly once at its station, and never on arrival as a second run' "$(qa_js '(()=>{const v=__me.S.visitor,r=v.runtime,st=Object.values(r.activities).filter(a=>v.source.experience.uses[a.useId].start.kind==="station");return st.length===1&&st[0].status==="complete"&&r.overrides.mesh?.highlight?.value===true;})()')" true
checkpoint traced

# ---- Cut executes none of it; a rebound invocation refuses locally instead of double running.
click '[data-command=back]';click '[data-act=exp-exit-preview]'
openseam;click '[data-act=exp-cut]';click '[data-act=exp-close]'
click '#experienceDeck [data-act=exp-preview-guide]'
click '[data-command=next]'
qa_ok 'Cut executes no route beat and no station invocation' "$(qa_js '(()=>{const v=__me.S.visitor,r=v.runtime,m=r.movement;return (!m||(!m.holds.length&&!m.invokes.length))&&!Object.values(r.activities).some(a=>v.source.experience.uses[a.useId].start.kind==="station");})()')" true
click '[data-act=exp-exit-preview]'
openseam;click '[data-act=exp-travel]';click '[data-act=exp-close]'
station_work="$station_use"
qa_js "window.__stationWork='$station_work'" >/dev/null
home="$(qa_jsv '(__me.ctx.experience.uses[window.__stationWork].presentationId)')"
click "#index [data-act=exp-open][data-id='$home']"
press "#card [data-act=pres-ref][data-id='$station_work']"
click '#card > details:nth-of-type(1) > summary'
choose '[data-exp-start]' visit
qa_ok 'rebinding the invocation to entry is honestly authored state' "$(qa_js '(()=>{const e=__me.ctx.experience;const u=e.uses[window.__stationWork];const s=Object.values(e.seams)[0];return u.start.kind==="visit"&&s.beats.some(b=>b.kind==="invoke"&&b.useId===u.id);})()')" true
click '#experienceDeck [data-act=exp-preview-guide]'
qa_ok 'Preview refuses the transition locally rather than running the Activity twice' "$(qa_js '(()=>{const b=document.querySelector("[data-command=next]"),v=__me.S.visitor;return b.disabled&&/triggered elsewhere/.test(document.querySelector(".visitor-controls").textContent)&&!Object.values(v.runtime.activities).some(a=>v.source.experience.uses[a.useId].start.kind==="station");})()')" true
click '[data-command=next]'
qa_ok 'the refusal keeps the visitor where they were: no fallback and no partial traversal' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.S.visitor.source.experience.guide[0]&&!__me.S.visitor.runtime.movement)')" true
click '[data-act=exp-exit-preview]'
openseam;click '[data-act=exp-travel]'
click '#experienceDeck [data-act=exp-coordinate]'
qa_ok 'the strip names the rebound Activity and offers its station repair' "$(qa_js '(/triggered elsewhere/.test(document.querySelector(".coordination-strip").textContent)&&!!document.querySelector("[data-act=exp-invoke-beat]"))')" true
click "[data-act=exp-station-focus][data-id='$station']"
choose '[data-exp-invoke-use]' "$station_work"
click '[data-act=exp-invoke-beat]'
qa_ok 'Invoke here restores the station binding as the Activity single trigger' "$(qa_js '(()=>{const e=__me.ctx.experience;const u=e.uses[window.__stationWork];const s=Object.values(e.seams)[0];return u.start.kind==="station"&&u.start.stationId===s.beats.find(b=>b.kind==="invoke").stationId&&s.beats.filter(b=>b.kind==="invoke").length===1;})()')" true
checkpoint repair

# ---- C9.6/J8: removing a Presentation retains the authored labelled choice that targeted it.
compare_pid="$(qa_jsv 'Object.values(__me.ctx.experience.presentations).find(p=>p.name=="Compare materials").id')"
click "#index [data-act=exp-open][data-id='$compare_pid']"
click '#card > details:nth-of-type(5) > summary'
click '#card [data-act=exp-remove-presentation]'
qa_ok 'removing a Presentation retains the authored labelled choice as an unresolved, repairable reference' "$(qa_js '(()=>{const e=__me.ctx.experience;for(const s of Object.values(e.stops)){const c=s.choices.find(c=>/Compare materials detour/.test(c.label));if(c)return !!c.label&&!e.stops[c.targetId];}return false;})()')" true
# ---- The retained choice is repairable and removable from its own Stop, and Preview never offers it.
broken="$(qa_jsv '(()=>{const e=__me.ctx.experience;for(const s of Object.values(e.stops)){const c=s.choices.find(c=>/Compare materials detour/.test(c.label));if(c)return s.id+"|"+c.id;}return "";})()')"
owner_stop="${broken%%|*}";broken_choice="${broken#*|}"
click '#index [data-act=exp-guide]'
click "#experienceDeck [data-act=exp-stop][data-id='$owner_stop']"
qa_js "(()=>{window.__ownerStop='$owner_stop';window.__brokenChoice='$broken_choice';return true;})()" >/dev/null
qa_js '(()=>{window.__brokenTarget=__me.ctx.experience.stops[window.__ownerStop].choices.find(c=>c.id===window.__brokenChoice).targetId;return true;})()' >/dev/null
qa_ok 'the Stop that authors the broken choice offers its own repair and removal' "$(qa_js '(()=>{return !!document.querySelector("[data-exp-choice-target="+JSON.stringify(window.__brokenChoice)+"]")&&!!document.querySelector("[data-act=exp-choice-remove]");})()')" true
press '#card [data-act=exp-preview-guide]'
qa_ok 'Preview marks the retained unresolved choice unavailable instead of offering it' "$(qa_js '(()=>{const b=[...document.querySelectorAll("[data-command=detour],[data-command=go]")].find(x=>/Compare materials detour/.test(x.textContent));return !!b&&b.disabled&&/repair required/.test(b.textContent);})()')" true
qa_js 'window.__brokenStop=__me.S.visitor.runtime.stopId' >/dev/null
qa_ok 'the runtime refuses the unresolved destination without parking the parent visit' "$(qa_js '(()=>{__me.E.visitorCommand("detour",window.__brokenTarget);const r=__me.S.visitor.runtime;return r.stopId===window.__brokenStop&&r.bookmarks.length===0&&/repair/.test(r.refusal||"");})()')" true
click '[data-act=exp-exit-preview]'
repair_target="$(qa_jsv "Object.values(__me.ctx.experience.stops).find(s=>s.id!=='$owner_stop').id")"
choose "[data-exp-choice-target='$broken_choice']" "$repair_target"
qa_ok 'repairing the destination points the authored choice at a resolving Stop' "$(qa_js "(()=>{const c=__me.ctx.experience.stops['$owner_stop'].choices.find(x=>x.id==='$broken_choice');return c.targetId==='$repair_target'&&!!__me.ctx.experience.stops[c.targetId];})()")" true
count_before="$(undo)"
press "[data-act=exp-choice-remove]"
qa_ok 'removing the choice is one Experience Undo and leaves the Stop itself untouched' "$(qa_js "(()=>{const s=__me.ctx.experience.stops['$owner_stop'];return !s.choices.some(x=>x.id==='$broken_choice');})()") / $(undo)" "true / $((count_before+1))"
click '#undoBtn';click '#undoBtn';click '#undoBtn'
qa_ok 'Undo restores the removed Presentation and its choice target' "$(qa_js '(()=>{const e=__me.ctx.experience;for(const s of Object.values(e.stops)){const c=s.choices.find(c=>/Compare materials detour/.test(c.label));if(c)return !!e.stops[c.targetId]&&!!e.presentations[e.stops[c.targetId].presentationId];}return false;})()')" true
checkpoint retained-choice
qa_faults_ok 'rich commands'
qa_browser_errors_ok 'rich browser'
qa_summary 'C9.7 rich example and local coordination'
