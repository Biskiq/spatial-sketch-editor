#!/usr/bin/env bash
# The UX4–UX6 review captures (PR #114 · the 2026-10-12 UX5-review pass): the corrected Guide Deck, the
# Camera Path posture and the Journey, each paired with a reading of what was photographed.
#
# Why this pass exists, and what it deliberately does *not* do. The 2026-10-12 review accepted the shell
# reconciliation and asked for one small set of current images instead of another review cycle: a Guide
# that is genuinely dense, the Camera half of a **Cut** edge, and the Journey, at both review sizes. It
# writes into its own directory only. `screens/experience-ux-before/` is UX0's genuine pre-overhaul
# baseline, and no capture pass grows it: the states below are current-tree evidence, taken on purpose.
#
# Each capture is accompanied by a reading of the state under the camera — the dense Guide's chip count,
# the one-based Stop a Cut edge really ends at, the posture and visitor transition a Path is open at, the
# point's own inspector, the Journey's Cues and their mirroring — so a reader can trust the image to be
# the state its name claims. Nothing here asserts appearance, which stays the owner's review against the
# QA boards.
#
# It is deliberately NOT part of run-all.sh: evidence is taken on purpose, like capture-baseline.sh.
#
# Usage: qa/capture-experience-ux456.sh [outdir]      (default: screens/experience-ux456)
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT=1
export QA_OUT="${1:-${QA_OUT:-$QA_DIR/../screens/experience-ux456}}"
export QA_QUERY="${QA_QUERY:-motion=instant}"
source "$QA_DIR/lib.sh"
qa_pass=0; qa_fail=0

# A control is activated through the page's own click, the way the other capture tools reach controls the
# fixed Guide band can cover at the foot of a tall Card.
tap() { # tap <selector>
  local js r
  js="(async () => { const e = document.querySelector($(python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1")); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()"
  r="$(qa_js "$js")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}
shot() { qa_snap "$1"; qa_say "qa: captured $QA_OUT/$1.png"; }
read_ok() { qa_ok "$1" "$(qa_js "$2")" true; }
# The Index's own Guide row exists at rest and inside the band, so opening Guide posture needs no
# branch: the ordinary strip's own door is not on screen once the band is open.
guide() { tap '#index [data-act=exp-guide]'; }
wide() { agent-browser set viewport 1440 900 >/dev/null; qa_frames; }
narrow() { agent-browser set viewport 1024 768 >/dev/null; qa_frames; }

qa_open
qa_say "qa: capturing the UX4–UX6 review states from $QA_BASE into $QA_OUT"
tap '#lens [data-lens=experience]'

# ---- UX4: the Guide Deck over a genuinely dense Guide (QA 4)
# The conformance fixture's six-Stop Guide, one Presentation of which appears twice, is the dense content
# QA 4's board is drawn over. Loading it selects nothing and opens nothing: the lane is read at rest.
tap '#experienceExamples [data-act=exp-conformance]'
qa_ok 'the loaded Guide is the six-Stop dense one these images mean' "$(qa_jsv '__me.ctx.experience.guide.length')" '6'
shot 'ux4-1440-guide-lane-dense'
read_ok 'the photographed lane is the ordinary Guide strip: six selected-able Stop chips, each followed by its own edge chip, in one row' \
  "(() => { const d = document.querySelector('#experienceDeck'); return !!d && d.classList.contains('ordinary') && d.querySelectorAll('.gd-stop-card').length === 6 && d.querySelectorAll('.gd-edge').length === 6 && !!d.querySelector('.gd-lane'); })()"
guide
shot 'ux4-1440-guide-band-dense'
read_ok 'the photographed band is the same dense lane, opened: one home, its own heading and the six chips inside it' \
  "(() => { const d = document.querySelector('#experienceDeck'); return !!d && !d.classList.contains('ordinary') && document.body.classList.contains('guide-band') && d.querySelectorAll('.gd-stop-card').length === 6 && !!d.querySelector('.gd-lane'); })()"
narrow
shot 'ux4-1024-guide-band-dense'
read_ok 'at 1024×768 the dense Guide stays one bounded band whose chips scroll inside their lane, with no sideways page scroll' \
  "(() => { const d = document.querySelector('#experienceDeck'), lane = d && d.querySelector('.gd-lane'); if (!d || !lane) return false; const r = d.getBoundingClientRect(), l = lane.getBoundingClientRect(); return r.height <= 112 && r.height < innerHeight * .4 && lane.scrollWidth > l.width && document.documentElement.scrollWidth === innerWidth; })()"
wide
first="$(qa_jsv '__me.ctx.experience.guide[0]')"
second="$(qa_jsv '__me.ctx.experience.guide[1]')"
tap "#experienceDeck [data-act=exp-seam][data-from='$first'][data-to='$second']"
shot 'ux4-1440-edge-card'
read_ok 'the photographed Card is the edge at Cut, and the destination Stop its sentence names is the one-based Stop the edge really ends at' \
  "(() => { const e = __me.ctx.experience, x = __me.S.experienceContext; if (!x.seam) return false; const t = (document.querySelector('#card [data-edge-cut]') || {}).textContent || ''; const named = (t.match(/Stop ([0-9]+)/) || [])[1]; return named === String(e.guide.indexOf(x.seam.to) + 1) && !!document.querySelector('#card [data-edge-coverage]') && !document.querySelector('#card [data-stop-entry]'); })()"

# ---- UX5: the Camera Path posture on a Cut edge (QA 1)
# Travel is chosen once so Camera owns real routes for every origin, then the transition is put back to
# Cut: the posture is the edge's Camera half at *either* mode, and the capture has to be of the Cut state
# the review asked about — the routes are retained, the transition is not.
tap '#card [data-act=exp-travel]'
tap '#card [data-act=exp-cut]'
tap '#card [data-act=exp-route]'
shot 'ux5-1440-path-cut'
read_ok 'the photographed Path posture is the Camera half of a Cut edge: the drawn route, the From list and the Camera Path Card, with the visitor transition still Cut' \
  "(() => { const x = __me.S.experienceContext, e = __me.ctx.experience; if (!x.seam || x.depth !== 'route') return false; const seam = e.seams[x.seam.from + '>' + x.seam.to]; const kind = (document.querySelector('#card .c-k') || {}).textContent || ''; return !!seam && seam.mode === 'cut' && !!document.querySelector('[data-exp-route]') && !!document.querySelector('#index [data-path-from]') && kind.includes('Camera Path') && !!document.querySelector('#pathInstrument [data-act=exp-path-point]'); })()"
# `+ Path point` is armed and one point is placed on the Stage, which is the creation path the capture has
# to show: the point lands in the drawn order, and its own Card is what is photographed next.
tap '#pathInstrument [data-act=exp-path-point]'
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
tap '#experienceDeck [data-act=exp-point-select]'
shot 'ux5-1440-point-inserted'
read_ok 'the photographed Card is that point own inspector, and the point is drawn once on the Stage and once in the lane' \
  "(() => { const c = document.querySelector('#card'); if (!c || !__me.S.experienceContext.point) return false; const kind = (c.querySelector('.c-k') || {}).textContent || ''; return kind.includes('Path point') && !!c.querySelector('[data-point-read]') && !!c.querySelector('[data-exp-point-preview]') && !!c.querySelector('[data-act=exp-point-remove]') && document.querySelectorAll('[data-exp-anchor]').length === 1 && document.querySelectorAll('#experienceDeck .topo-point').length === 1; })()"
narrow
tap '[data-act=sheet-card]'
shot 'ux5-1024-path'
read_ok 'at 1024×768 the Path posture keeps its Camera home in an invoked Card sheet over the band, with no sideways scroll' \
  "(() => { const c = document.querySelector('#card').getBoundingClientRect(); return __me.S.experienceContext.depth === 'route' && !!__me.S.sheet.card && c.left >= 0 && c.right <= innerWidth && !!document.querySelector('[data-path-lane]') && document.documentElement.scrollWidth === innerWidth; })()"
tap '[data-act=sheet-card]'
wide

# ---- UX6: the Journey and its Cue Card (QA 2)
# The loaded example ships an authored Seam with a hold and a station-only invocation, so the Journey has
# real Cues to read without building a timeline in front of the camera.
tap '#experienceExamples [data-act=exp-example]'
guide
first="$(qa_jsv '__me.ctx.experience.guide[0]')"
second="$(qa_jsv '__me.ctx.experience.guide[1]')"
tap "#experienceDeck [data-act=exp-seam][data-from='$first'][data-to='$second']"
tap '#card [data-act=exp-route]'
tap '#index [data-exp-posture-switch] [data-act=exp-coordinate]'
shot 'ux6-1440-journey'
read_ok 'the photographed Journey is the authored Seam as time: one Cue marker per authored Cue, a 0:00 start naming the edge, and the Journey Card with its station choice' \
  "(() => { const r = __me.E.rehearsalReading(); if (!document.querySelector('[data-journey-deck]')) return false; const marks = [...document.querySelectorAll('.jd-cue')]; const ends = [...document.querySelectorAll('.jd-ends .jd-end')].map(e => e.textContent.trim()); return marks.length === r.clock.cues.length && marks.length > 0 && ends[0] === '0:00.0' && !!document.querySelector('[data-exp-journey-total]') && !!document.querySelector('#card [data-exp-station]') && !!document.querySelector('#card [data-act=exp-beat]') && __me.S.experienceContext.depth === 'coordination'; })()"
station="$(qa_jsv 'Object.values(__me.ctx.experience.seams)[0].beats.find(b=>b.kind==="invoke").stationId')"
qa_js "window.__cue='$station'" >/dev/null
tap "#experienceDeck .jd-cue[data-id='$station']"
shot 'ux6-1440-cue-card'
read_ok 'the photographed Cue is one Cue: its Card reads the occurrence, the time, the pause and the actions, and the Deck marker and Stage chip mirror the same identity' \
  "(() => { const c = document.querySelector('#card'), kind = (c.querySelector('.c-k') || {}).textContent || ''; return kind.includes('Cue') && !!c.querySelector('[data-cue-at]') && !!c.querySelector('[data-cue-pause]') && !!c.querySelector('[data-cue-actions]') && !!c.querySelector('[data-exp-cue-edit]') && !!document.querySelector(\".jd-cue.selected[data-id='\" + window.__cue + \"']\") && !!document.querySelector(\"[data-exp-station-label='\" + window.__cue + \"'].active\"); })()"
narrow
shot 'ux6-1024-journey'
read_ok 'at 1024×768 the Journey keeps its one Deck above the invoked Cue Card sheet, with no sideways scroll' \
  "(() => { const deck = document.querySelector('[data-journey-deck]'); if (!deck) return false; const d = document.querySelector('#experienceDeck').getBoundingClientRect(); const chip = document.querySelector('#experienceDeck .jd-cue.selected'); return d.height < innerHeight * .4 && !!chip && chip.getBoundingClientRect().right <= innerWidth + 1 && document.documentElement.scrollWidth === innerWidth; })()"
wide

qa_faults_ok 'no command or page faults while capturing'
qa_ok 'every UX4–UX6 reading above passed' "$qa_fail" 0
qa_summary "UX4–UX6 review captures ($QA_OUT)"
