#!/usr/bin/env bash
# QA 5's own capture pass (PR #114 · UX3): the Scene subject's Card at both review sizes.
#
# It is the pair tool for the QA 5 board: the subject's Card as it reads in the order QA 5 fixes (identity
# → `Present this` → the derived `Used in Experience` reach → the subject's own two doors, with no
# capability control at rest), the chooser its behavior door opens over the declared descriptors, and the
# one invoked operation with the UX2 audition and capture writers on screen. At 1024×768 the same Card is an
# invoked sheet, and the invoked operation is reachable inside it by scrolling, as an author reaches it.
# Each capture is accompanied by a reading of what was photographed — that nothing is operated at rest,
# that the chooser lists what the provider declares, that the invoked row carries the audition control, and
# that the derived rows are references rather than a second editor — so a reader can trust the image to be
# the state the name claims. It asserts nothing about appearance: the visual review is the owner's.
#
# It is deliberately NOT part of run-all.sh: evidence is taken on purpose, like capture-baseline.sh.
#
# Usage: qa/capture-experience-subject.sh [outdir]      (default: screens/experience-ux3)
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT=1
export QA_OUT="${1:-${QA_OUT:-$QA_DIR/../screens/experience-ux3}}"
export QA_QUERY="${QA_QUERY:-motion=instant}"
source "$QA_DIR/lib.sh"
qa_pass=0; qa_fail=0

read_ok() { # read_ok <name> <expression of the page>
  qa_ok "$1" "$(qa_js "$2")" true
}
shot() { # shot <name>
  qa_snap "$1"
  qa_say "qa: captured $QA_OUT/$1.png"
}
# The chooser's rows, and what they name: the descriptor ids the subject's profile declares.
chooser_rows() { echo '[...document.querySelectorAll("#card [data-exp-choice]")].map(e=>e.dataset.expChoice).join(",")'; }
at_rest() { echo '(!document.querySelector("#card [data-exp-audition]")&&!document.querySelector("#card [data-act=exp-use]")&&!document.querySelector("#card [data-act=exp-use-scope]")&&!document.querySelector("#card [data-act=exp-audition]"))'; }

qa_open
qa_say "qa: capturing QA 5 (Scene subject) from $QA_BASE into $QA_OUT"

tap() { # tap <selector>
  local js r
  js="(async () => { const e = document.querySelector($(python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1")); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()"
  r="$(qa_js "$js")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}

# The subject is reached the way an author reaches it: the example is loaded and the subject is selected
# from the same shared locator every lens uses, so the Card under the camera is the one a click produced.
tap '#lens [data-lens=experience]'
tap '#experienceExamples [data-act=exp-example]'
qa_locator_select machine

# At rest: nothing is operated, the derived reach names what exists, and both doors are there.
shot 'qa5-1440-subject-card'
read_ok 'the photographed Card is the machine subject at rest, with both doors and no capability control' \
  "(() => { const c = document.querySelector('#card'); return __me.S.sel === 'machine' && c.querySelector('.c-k').textContent.includes('World lens') && !!c.querySelector('[data-act=exp-add-behavior]') && !!c.querySelector('[data-act=exp-add-interaction]') && $(at_rest); })()"
read_ok 'the photographed order is identity → Present this → Used in Experience → the two doors' \
  "JSON.stringify([...document.querySelectorAll('#card > .c-sec')].map(e=>e.textContent.trim().split(' · ')[0])) === JSON.stringify(['Presentation','Used in Experience','Behavior'])"
read_ok 'the derived reach is read-only: every row is a reference to its owner, none is a second editor' \
  "(() => { const rows = [...document.querySelectorAll('#card [data-exp-used-in] [data-exp-used]')]; return rows.length > 0 && rows.every(r => !!r.querySelector('button') && !r.querySelector('[data-act=exp-use],[data-act=exp-audition],[data-act=exp-choose-capability]')); })()"

# The door, and the chooser it opens: what the provider declares, and nothing operated by opening it. The
# source digest and the history depth are taken here, so the two steps on the way to the operation are read
# as writing nothing rather than asserted to be equal to themselves.
before="$(qa_js '(()=>{const s=JSON.stringify(__me.A.domainSnapshot());let h=0;for(const ch of s)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;return h;})()')"
count="$(qa_jsv '__me.S.undo.length')"
tap '#card [data-act=exp-add-behavior]'
shot 'qa5-1440-chooser'
qa_ok 'the photographed state is the chooser, over exactly the declared descriptors' \
  "$(qa_jsv "JSON.stringify([!!document.querySelector('#card [data-exp-chooser]'),$(chooser_rows),$(at_rest)])")" \
  '[true,"casing,rotor,highlight,visibility",true]'
read_ok 'the chooser reads from its own first row, brought into the Card’s view rather than left below the fold' \
  "(() => { const hit = (e) => { const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && (at === e || e.contains(at)); }; return hit(document.querySelector('#card [data-exp-chooser]')) && hit(document.querySelector('#card [data-act=exp-choose-capability][data-cap=casing]')); })()"

# The other door: `+ Visitor interaction` opens the ordinary offer draft with *this* subject as its target
# and activation, brought into the Card's own view, and opening it writes nothing either.
tap '#card [data-act=exp-choose-cancel]'
qa_ok 'cancelling the chooser returns the Card to rest and writes nothing' \
  "$(qa_js '(!document.querySelector("#card [data-exp-chooser]")&&!document.querySelector("#card [data-exp-invoked]")&&!document.querySelector("#card [data-exp-audition]"))') / $(qa_jsv '__me.S.undo.length')" "true / $count"
tap '#card [data-act=exp-add-interaction]'
shot 'qa5-1440-interaction'
read_ok 'the interaction door opens the draft with this subject as its target and activation, in view' \
  "(() => { const d = document.querySelector('#card [data-exp-offer-draft]'); if (!d) return false; const t = d.querySelector('[data-exp-offer=subjectId]'), g = d.querySelector('[data-exp-offer=trigger]'); if (!t || !g || t.value !== 'machine' || g.value !== 'machine') return false; const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()"
qa_ok 'opening the offer draft wrote no source and no history' "$(qa_jsv '__me.S.undo.length')" "$count"
tap '#card [data-act=exp-offer-cancel]'

# The invoked operation: the same UX2 audition and capture writer, on screen because one was invoked.
tap '#card [data-act=exp-add-behavior]'
tap '#card [data-act=exp-choose-capability][data-cap=casing]'
shot 'qa5-1440-invoked'
read_ok 'the photographed Card shows casing invoked: its audition control, its capture writer and the fact that it is temporary' \
  "(() => { const c = document.querySelector('#card'); const a = c.querySelector('[data-exp-audition=casing]'); return !!a && !!c.querySelector('[data-act=exp-use][data-cap=casing]') && c.textContent.includes('Temporary projection') && !!c.querySelector('[data-exp-invoked=casing]') && !c.querySelector('[data-exp-chooser]'); })()"
read_ok 'the invoked operation is brought into the Card’s own view, not left below the fold' \
  "(() => { const hit = (e) => { const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width > 0 && r.bottom <= innerHeight && (at === e || e.contains(at)); }; return hit(document.querySelector('#card [data-exp-audition=casing]')) && hit(document.querySelector('#card [data-act=exp-use][data-cap=casing]')); })()"
read_ok 'only the invoked operation is on screen: no other descriptor has a control' \
  "(() => { const caps = ['rotor','highlight','visibility']; return caps.every(id => !document.querySelector('#card [data-act=exp-audition][data-cap=' + id + ']') && !document.querySelector('#card [data-exp-audition=' + id + ']')); })()"
qa_ok 'opening the door and invoking one operation wrote no source and no history' \
  "$(qa_js '(()=>{const s=JSON.stringify(__me.A.domainSnapshot());let h=0;for(const ch of s)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;return h;})()') / $(qa_jsv '__me.S.undo.length')" \
  "$before / $count"

# The narrow sheet: the same Card in the same order, and the invoked operation reachable inside it.
agent-browser set viewport 1024 768 >/dev/null
qa_frames
tap '#card [data-act=exp-invoke-close]'
qa_locator_select machine
tap '[data-act=sheet-card]'
shot 'qa5-1024-subject-card'
read_ok 'inside the narrow sheet the photographed Card is the same subject at rest with the same order' \
  "(() => { const c = document.querySelector('#card').getBoundingClientRect(); return !!(!!__me.S.sheet.card && c.right <= innerWidth && c.left >= 0 && __me.S.sel === 'machine' && $(at_rest) && document.querySelector('#card [data-act=exp-add-behavior]') && document.querySelector('#card [data-act=exp-add-interaction]')); })()"
tap '#card [data-act=exp-add-behavior]'
tap '#card [data-act=exp-choose-capability][data-cap=casing]'
qa_scroll_center '#card [data-exp-audition=casing]'
shot 'qa5-1024-invoked'
read_ok 'inside the narrow sheet the invoked operation is reached by scrolling, audition and writer alike' \
  "(() => { const hit = (e) => { const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (at === e || e.contains(at)); }; return hit(document.querySelector('#card [data-exp-audition=casing]')) && hit(document.querySelector('#card [data-act=exp-use][data-cap=casing]')); })()"

qa_faults_ok 'no command or page faults while capturing'
qa_ok 'every QA 5 reading above passed' "$qa_fail" 0
qa_summary "QA 5 captures ($QA_OUT)"
