#!/usr/bin/env bash
# The Experience shell's composition (PR #114 · UX0): the six homes, the one bounded Deck lane, the
# visitor surface, and the §6 laws at both review sizes.
#
# These are composition laws, so they are checked as composition: which home exists, how many of it
# exist, where the Deck is mounted, what is hit-reachable at the same time, and what a layout change
# does *not* write. Spatial behaviour, C9 capability and the visitor's execution belong to the other
# axes; this one never re-tests them.
#
# Controls are addressed by their semantic home (`data-home`) and action (`data-act`), and the Deck
# names its own posture (`data-deck-posture`), so #114's UX1–UX7 slices can move a control between
# homes and re-point the recipe that owns it instead of weakening an assertion.
#
# UX1's consolidation is asserted here rather than in a second axis: the shell offers exactly one
# Preview control (the Head's `Preview ▾` menu), every scope it offers lives inside it, and the menu
# closes behind the visit it starts. The locator coverage that UX1's other exit gate claims — every
# subject the retired Index Scene list named, by pointer and keyboard — is asserted in ./locator-check.sh.
#
# Usage: qa/experience-shell-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-experience-shell}"
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

# One page-side helper set: every reading below is one eval, so an assertion costs no extra round trip
# and two measurements in one reading cannot straddle a layout change.
install_helpers() { qa_js "$(cat <<'JS'
window.ux0 = (() => {
  const { S, qa: q } = __me;
  // On screen *and* the thing a real pointer at its centre would hit. An element under a fixed band or
  // inside a hidden sheet is not reachable.
  const reachable = (elOrSel) => {
    const e = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
    if (!e) return null;
    const b = e.getBoundingClientRect();
    if (b.width < 0.5 || b.height < 0.5) return false;
    if (b.bottom > innerHeight + 0.5 || b.top < -0.5) return false;
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return hit === e || e.contains(hit) || (!!hit && hit.contains(e));
  };
  const homes = () => ['head', 'index', 'stage', 'card', 'deck', 'preview']
    .reduce((o, h) => (o[h] = document.querySelectorAll('[data-home=' + h + ']').length, o), {});
  const deck = () => document.querySelector('[data-home=deck]');
  // The band: how tall, in which home, is its heading reachable, does anything inside it scroll, does
  // the document scroll sideways. Measured after the band renders, so the Card inset is included.
  const band = () => {
    const d = deck();
    if (!d) return { mounted: false };
    const r = d.getBoundingClientRect();
    return {
      mounted: true,
      posture: d.dataset.deckPosture || null,
      parentIsStageOrBody: d.parentElement === document.body || d.parentElement === document.querySelector('[data-home=stage]'),
      h: Math.round(r.height),
      frac: +(r.height / innerHeight).toFixed(3),
      headingReachable: reachable(d.firstElementChild),
      // A nested scroller is a region the author can actually scroll: overflow hidden that clamps a
      // summary is a density question, not a second scroller.
      nested: [...d.querySelectorAll('*')].filter((e) => ['auto', 'scroll', 'overlay'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2).length,
      docScrollX: document.documentElement.scrollWidth - innerWidth
    };
  };
  // The Card first block is its identity; the band first child is its heading. Neither is
  // addressed by the class it wears today.
  const cardIdentityReachable = () => {
    const c = document.querySelector('[data-home=card]');
    return c.checkVisibility() ? reachable(c.firstElementChild) : null;
  };
  // Source digest, history depth, selection and the realized standpoint: what a layout change may not move.
  const fingerprint = () => JSON.stringify({
    source: q.hash() + '|' + S.undo.length + '|' + S.redo.length,
    sel: S.sel,
    pose: __me.nav.plainPose()
  });
  const stageRect = () => JSON.stringify(document.querySelector('[data-home=stage]').getBoundingClientRect());
  // The Index as text, not as boxes: every line of text a row paints must be on its own line, inside its
  // own row and inside the column. A row whose label and explanation are two elements is one laid-out
  // thing, but a label that shrinks to nothing while its text still paints does not overlap as *boxes* —
  // so the reading is of painted line boxes, which is what the author sees. UX2 review: `+ Present` and
  // `Browse World` painted their labels across their own explanations at 1440×900.
  const indexText = () => {
    const idx = document.querySelector('#index');
    if (!idx || !idx.getBoundingClientRect().width) return { index: 0, rows: 0 };
    const ix = idx.getBoundingClientRect();
    const lines = (node, out) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(child);
          for (const b of r.getClientRects()) if (b.width > 0.5) out.push({ text: child.textContent.trim().slice(0, 24), l: b.left, r: b.right, t: b.top, b: b.bottom });
        } else if (child.nodeType === 1) lines(child, out);
      }
      return out;
    };
    const out = { index: Math.round(ix.width), rows: 0, overflow: 0, collide: 0, escape: 0 };
    for (const row of idx.querySelectorAll('.ix-row')) {
      out.rows++;
      const rr = row.getBoundingClientRect();
      const ls = lines(row, []).filter((b) => b.t >= rr.top - 1 && b.b <= rr.bottom + 1);
      if (row.scrollWidth > row.clientWidth + 1) out.overflow++;
      for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
        const a = ls[i], c = ls[j];
        if (Math.abs(a.t - c.t) < 4 && a.r > c.l + 0.5 && c.r > a.l + 0.5) out.collide++;
      }
      if (ls.some((b) => b.r > rr.right + 0.5 || b.r > ix.right + 0.5)) out.escape++;
    }
    return out;
  };
  // The law is the five facts; the counts behind them are reported beside it rather than asserted, because
  // how many rows the Index holds depends on what the axis has authored by then and is not the law.
  const indexLineLaw = () => {
    const r = indexText();
    return [r.index > 0, r.rows > 0, r.overflow === 0, r.collide === 0, r.escape === 0].join('|');
  };
  // UX1: the shell has one Preview control, and every control that can start a visit is inside it.
  const previewOutside = () => [...document.querySelectorAll('[data-act^=exp-preview]')]
    .filter((b) => !document.querySelector('#headPreview').contains(b)).length;
  // UX2: the View preview's image pass is a derivative reading with two laws — bounded and neutral. Both
  // are claims about readings, so one function gathers exactly what a draw may not move: source digest,
  // history, the canonical selection, the standpoint, the session audition, the values the audition is
  // realized as, the held reading, the realized camera and the stage rect.
  const passState = () => JSON.stringify({
    fp: fingerprint(),
    audition: JSON.stringify(S.expAudition || null),
    hold: __me.nav.hold(),
    realized: JSON.stringify(q.realized()),
    stage: stageRect()
  });
  // The values an audition is realized as on the Stage: what the pass has to have put back, not merely
  // remembered in session state.
  const machineCaps = () => {
    const i = __me.ctx.stage.items.get('machine');
    return [i?.capabilityParts?.lid?.rotation?.z ?? null, i?.capabilityParts?.rotor?.rotation?.y ?? null].map((n) => (n === null ? n : +n.toFixed(4)));
  };
  // What one produced image must read as, given the pass's draw count before the window opened: draws this
  // window, still pending, worst backlog ever, session cache size, the failure it reported (or 'ok'), the
  // time it took under the §3.6 ceiling, the picture being a real render rather than a placeholder, and the
  // projection being a normal-World reading — no paper, no selection/ghost/drafting treatment, no clipping.
  const imageReading = (drawsBefore) => {
    const i = q.images();
    const el = document.querySelector('[data-exp-preview] [data-exp-preview-image]');
    const p = i.projection || {};
    return [i.drawn - drawsBefore, i.queued, i.peak, i.cached, i.lastFail || 'ok', i.lastMs < 50,
      !!el, /^data:image\//.test(el?.getAttribute('src') || ''),
      p.paper === 0 && p.authoring === false && p.clips === 0].join('|');
  };
  // The live camera object the pass must never replace: it swaps its own in and restores the reference.
  const liveCamHeld = () => __me.ctx.stage.cam === window.ux2Cam;
  return { reachable, homes, deck, band, cardIdentityReachable, fingerprint, stageRect, previewOutside, passState, imageReading, liveCamHeld, machineCaps, indexText, indexLineLaw };
})()
JS
)" >/dev/null; }

# A control inside the shell is activated through the page's own click, the same way the other axes
# reach controls that live in a collapsed disclosure: the Experience loaders sit inside a closed
# <details>, so a real pointer click cannot see them.
tap() { # tap <selector>
  local r
  r="$(qa_js "(async () => { const e = document.querySelector('$1'); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}
band() { qa_jsv 'JSON.stringify(window.ux0.band())'; }
bandof() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2]))' "$(band)" "$1"; }
# Every posture's share must sit under the reserved share, and the worst one is reported.
band_under() { # band_under <fraction...> <limit>
  python3 - "$@" <<'PY'
import sys
vals = [float(v) for v in sys.argv[1:-1]]
limit = float(sys.argv[-1])
worst = max(vals) if vals else None
print("true" if vals and worst <= limit else f"false (worst {worst} against {limit})")
PY
}
# <fraction> <heading> <nested> <docScrollX> as one line, so one label can carry the whole band law.
band_law() { python3 -c '
import json, sys
b = json.loads(sys.argv[1])
print("|".join([str(b.get("mounted")), str(b.get("parentIsStageOrBody")), str(b.get("headingReachable")), str(b.get("nested") == 0), str(b.get("docScrollX") == 0)]))' "$1"; }

qa_open
install_helpers
qa_say "== PR #114 · the Experience shell's composition"
qa_faults_clear

echo "-- one shell, with each home declared once"
tap '#lens [data-lens=experience]'
qa_ok 'every home the shell sketch names exists exactly once (the Deck is built with a Guide)' "$(qa_jsv 'JSON.stringify(window.ux0.homes())')" '{"head":1,"index":1,"stage":1,"card":1,"deck":0,"preview":1}'
qa_ok 'the stage home owns the drawing' "$(qa_js 'document.querySelector("[data-home=stage]").contains(document.querySelector("#gl"))')" true
qa_ok 'the visitor surface is not the authoring shell: hidden, and the Deck is not built before a Guide exists' "$(qa_jsv 'JSON.stringify([document.querySelector("[data-home=preview]").checkVisibility(), window.ux0.deck() === null])')" '[false,true]'
qa_ok 'exactly one inspector, and no work in hand at rest' "$(qa_jsv 'JSON.stringify([document.querySelectorAll("[data-home=card]").length, document.querySelectorAll("#experienceInstrument, #instrument:not([hidden])").length])')" '[1,0]'
# The Index is text an author reads: two lines may not be painted on top of each other, and no line may
# leave the row it belongs to or the column. Measured as painted line boxes at both review sizes.
qa_ok 'every line the Index paints is on its own line, inside its row and inside the column' \
  "$(qa_jsv 'window.ux0.indexLineLaw()')" 'true|true|true|true|true'
qa_say "qa: Index at 1440×900 · $(qa_jsv 'JSON.stringify(window.ux0.indexText())')"

echo "-- the Deck is one bounded lane in one home"
tap '#experienceExamples [data-act=exp-example]'
qa_ok 'a Guide mounts, with one Deck naming its own posture' "$(qa_jsv 'JSON.stringify([__me.ctx.experience.guide.length, document.querySelectorAll("[data-home=deck]").length, !!window.ux0.deck().dataset.deckPosture, window.ux0.deck().parentElement === document.querySelector("[data-home=stage]")])')" '[3,1,true,true]'
qa_ok 'one Deck, and only the Deck declares a posture' "$(qa_jsv 'JSON.stringify([document.querySelectorAll("[data-home=deck]").length, document.querySelectorAll("[data-deck-posture]").length])')" '[1,1]'
peek="$(band)"
qa_snap 'experience-shell-1440-ordinary'

echo "-- opening a posture writes nothing and navigates nowhere"
before="$(qa_jsv 'window.ux0.fingerprint()')"
tap '#experienceDeck [data-act=exp-guide]'
guide="$(band)"
qa_snap 'experience-shell-1440-guide'
qa_ok 'the Guide home is a band in one home, with nothing scrolling inside it and no sideways document scroll' "$(band_law "$guide")" 'True|True|True|True|True'
qa_ok 'opening the Guide home writes no source, history or Camera intent' "$(qa_jsv 'window.ux0.fingerprint()')" "$before"
# The edge posture is the deepest the shell has today: it is opened from the Guide overview's own
# between-Stops control, and the example's edge carries beats, so it opens into coordination inside
# the same band. UX4 replaces that control with the Guide edge Card and re-points the action below.
tap '#experienceDeck [data-act=exp-seam]'
edge="$(band)"
qa_ok 'the edge posture stays in the band, in one home, heading reachable, nothing scrolling inside it' "$(band_law "$edge")" 'True|True|True|True|True'
qa_ok 'opening the edge posture writes no source, history or Camera intent' "$(qa_jsv 'window.ux0.fingerprint()')" "$before"
# Whenever the Card is on screen, its own identity block must be reachable at the same time as the
# band's heading — the Card is inset for the band, so neither may push the other out of reach.
qa_ok 'the Card keeps its identity reachable while the band is open' "$(qa_jsv 'JSON.stringify([window.ux0.cardIdentityReachable(), window.ux0.band().headingReachable])')" '[true,true]'
qa_ok 'the band sits under the reserved share in every posture reached so far' "$(band_under "$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["frac"])' "$peek")" "$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["frac"])' "$guide")" "$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["frac"])' "$edge")" 0.40)" true

echo "-- one Preview control, and the visitor surface is the only visible home in Preview"
# UX1 consolidated every Preview entry into the Head's `Preview ▾` menu: the control exists once, its
# scopes are the ones that can actually start, and nothing elsewhere in the shell can begin a visit.
preview_control="$(qa_jsv 'JSON.stringify([window.ux0.previewOutside(), document.querySelector("#headPreview").hidden, document.querySelectorAll("#previewScopes button[data-scope]").length > 0])')"
qa_ok 'the shell offers exactly one Preview control, and every scope it offers is inside it' \
  "$preview_control" '[0,false,true]'
context_before="$(qa_jsv 'window.ux0.fingerprint()')"
preview_posture="$(bandof posture)"
qa_click '#headPreview > summary' >/dev/null 2>&1
sleep 0.5
# The menu is chrome, and it opens over the shell: every scope it offers must be a real hit target inside
# the viewport, and opening it must not push the document sideways.
qa_ok 'the open Preview menu offers every scope as a real hit target, with no sideways scroll' \
  "$(qa_js '[...document.querySelectorAll("#previewScopes button")].every((b) => window.ux0.reachable(b))') / $(qa_js 'document.querySelector("#headPreview").open') / $(qa_js 'document.documentElement.scrollWidth - innerWidth')" \
  'true / true / 0'
# The disclosure is native. `<details>` already reports its own expanded state, so the summary must not
# carry a second `aria-expanded` that could disagree with it, and a real Enter must open and close it.
qa_ok 'the Preview summary states its expansion natively, with no aria-expanded copy to disagree with it' \
  "$(qa_js 'document.querySelector("#headPreview > summary").getAttribute("aria-expanded")') / $(qa_js 'document.querySelector("#headPreview").open')" \
  'null / true'
qa_js 'document.querySelector("#headPreview > summary").focus()' >/dev/null
agent-browser press Enter >/dev/null 2>&1
qa_frames
qa_ok 'a real Enter on the focused summary closes the disclosure (native activation, no scripted state)' \
  "$(qa_js 'document.querySelector("#headPreview").open') / $(qa_js 'document.querySelector("#headPreview > summary").getAttribute("aria-expanded")')" 'false / null'
agent-browser press Enter >/dev/null 2>&1
qa_frames
qa_ok '…and a second Enter opens it again' "$(qa_js 'document.querySelector("#headPreview").open')" 'true'
qa_click '#headPreview > summary' >/dev/null 2>&1
qa_preview_presentation || qa_fail_msg 'the Head Preview menu did not start the Presentation scope'
qa_ok 'the menu closes behind the visit it started' "$(qa_js 'document.querySelector("#headPreview").open')" 'false'
qa_ok 'Preview hides every authoring home and unmounts the Deck' "$(qa_jsv 'JSON.stringify({ preview: document.querySelector("[data-home=preview]").checkVisibility(), head: document.querySelector("[data-home=head]").checkVisibility(), index: document.querySelector("[data-home=index]").checkVisibility(), card: document.querySelector("[data-home=card]").checkVisibility(), deck: document.querySelectorAll("[data-home=deck]").length, presenter: document.querySelector("#experienceExamples").checkVisibility() })')" '{"preview":true,"head":false,"index":false,"card":false,"deck":0,"presenter":false}'
qa_ok 'exactly one Exit Preview, and no authoring writer or nested home inside the visitor surface' "$(qa_jsv 'JSON.stringify([[...document.querySelectorAll("[data-act=exp-exit-preview]")].filter((b) => b.checkVisibility()).length, !!document.querySelector("[data-home=preview] [data-home]"), !!document.querySelector("[data-home=preview] [data-exp-primary]"), !!document.querySelector("[data-home=preview] [data-act=exp-capture]")])')" '[1,false,false,false]'
qa_snap 'experience-shell-1440-preview'
tap '[data-act=exp-exit-preview]'
qa_ok 'leaving Preview restores the exact authoring context: same source, history, selection, standpoint and Deck posture' "$(qa_jsv 'window.ux0.fingerprint()') / $(bandof posture)" "$context_before / $preview_posture"

# A field is committed the way an author commits it: a real fill, then the key that accepts the value.
fill(){ agent-browser fill "$1" "$2" >/dev/null; qa_press Enter; }
# A selector goes to the page as a JSON string, never interpolated into JavaScript source: a selector
# legitimately contains quotes, and a hand-built literal would turn a working control into a syntax error
# the harness would read as a missing one.
jsq() { python3 -c 'import json, sys; print("document.querySelector(%s)" % json.dumps(sys.argv[1]))' "$1"; }
# Select something and read the pass state in the SAME synchronous turn: no frame, and therefore no draw,
# can happen between the click and the reading, so the draw that follows is provably inside the window
# whose two ends are compared. A second argument may put session state back the way the author had it, in
# that same turn — a View selection drops a subject audition, so the two are taken together.
pick() { # pick <selector> [session statements-in-one-expression]
  qa_jsv "(async () => { const e = $(jsq "$1"); if (!e) return 'missing'; e.click(); ${2:-} window.ux2Cam = __me.ctx.stage.cam; return window.ux0.passState(); })()"
}
# The pass draws on an idle turn, and a backgrounded tab has no animation loop of its own, so the frames are
# driven rather than waited for. Returns nonzero if the picture never arrives.
wait_image() { # wait_image <selector>
  local js; js="!!$(jsq "$1")"
  for _ in $(seq 1 30); do qa_frames; [ "$(qa_js "$js")" = "true" ] && return 0; done
  return 1
}

echo "-- the View preview image pass: bounded, and neutral to the author"
# UX2: the View Card shows a picture the Stage's own renderer produced from the View's resolved pose. The
# plan holds that pass to two laws — bounded (§3.6: one draw per idle turn, a small session cache, under
# 50 ms) and neutral (§8/§10.3: no source, history, selection or clock write; the author's own projection,
# standpoint and session state restored in the same synchronous turn; live navigation never moved). It is
# read here because the shell axis owns the pass's interaction; what the picture looks like belongs to the
# View Card, and is read by the QA 3 capture pass and the conformance axis.
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
row() { printf '[data-exp-views] [data-exp-view-use="%s"]' "$1"; }
view() { qa_jsv "(__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[$1])"; }
# Selecting a View use drops a subject-local audition, so the audition that the pass must put back is set in
# the same turn as the selection, through the writer the Subject Card's own control calls.
audition="__me.E.auditionCapability('machine','casing',0.6);"
tap "#index [data-act=exp-open][data-id=\"$pid\"]"
use_cold="$(view 0)"; use_warm="$(view 2)"; use_fail="$(view 1)"
draws="$(qa_jsv '__me.qa.images().drawn')"
pre="$(pick "$(row "$use_cold")" "$audition")"
# The reading is not vacuous: the window really carries live session state for the pass to restore.
qa_ok 'the audited draw is taken with live session state, not an idle page' \
  "$(qa_jsv 'JSON.stringify(__me.S.expAudition)') / $(qa_js 'window.ux0.liveCamHeld()')" \
  '{"machine":{"open":0.6}} / true'
qa_ok 'a View is selected by its own row, and the selection is the only thing that moved' \
  "$(qa_js '__me.S.sel')" "\"$use_cold\""
wait_image "[data-exp-preview=\"$use_cold\"] [data-exp-preview-image]" || qa_fail_msg "the preview never rendered for $use_cold"
cold_ms="$(qa_jsv '__me.qa.images().lastMs')"
qa_ok 'one idle turn drew the picture once, from the Stage renderer itself, with nothing left pending' \
  "$(qa_jsv "window.ux0.imageReading($draws)")" '1|0|1|1|ok|true|true|true|true'
qa_ok 'the pass wrote nothing: source, history, selection, audition, standpoint, realized camera and stage exactly as the selection left them' \
  "$(qa_jsv 'window.ux0.passState()') / $(qa_js 'window.ux0.liveCamHeld()')" "$pre / true"
qa_ok '…and the audition it restored is realized on the Stage, not merely remembered as session state' \
  "$(qa_jsv 'JSON.stringify(window.ux0.machineCaps())')" '[0.72,0]'
# Warm: the same View again. Its pose is resolved and its picture is already drawn, so it costs no draw.
tap "#index [data-act=exp-open][data-id=\"$pid\"]"
warm="$(pick "$(row "$use_cold")")"
qa_frames
qa_ok 'a View already drawn is served from the session cache: a warm selection costs no draw' \
  "$(qa_jsv "window.ux0.imageReading($((draws + 1)))")" '0|0|1|1|ok|true|true|true|true'
qa_ok '…and the cache is the bounded session cache the plan allows, reported as it stands' \
  "$(qa_js '__me.qa.images().cached<=32') / $(qa_jsv '__me.qa.images().cached')" 'true / 1'
# A second, never-drawn View: exactly one further draw, keyed by its own pose, with the same neutrality and
# the same live session state to put back.
tap "#index [data-act=exp-open][data-id=\"$pid\"]"
pre2="$(pick "$(row "$use_warm")" "$audition")"
wait_image "[data-exp-preview=\"$use_warm\"] [data-exp-preview-image]" || qa_fail_msg "the preview never rendered for $use_warm"
second_ms="$(qa_jsv '__me.qa.images().lastMs')"
qa_ok 'a second View is drawn in its own turn from its own pose, and leaves the author just as untouched' \
  "$(qa_jsv "window.ux0.imageReading($((draws + 1)))") / $(qa_jsv 'window.ux0.passState()') / $(qa_jsv 'JSON.stringify(window.ux0.machineCaps())')" \
  "1|0|1|2|ok|true|true|true|true / $pre2 / [0.72,0]"
qa_say "qa: image pass · cold ${cold_ms} ms · second ${second_ms} ms · cache $(qa_jsv '__me.qa.images().cached') of 32 · one draw per new pose, one job outstanding at a time"
# A derivative picture is a reading of one World, so it is fogged — and keyed — as its own projection. The
# fog belongs to the picture's own eye distance; `lastSnapshot.dist` is that distance and the fog is read
# from it, never from the standpoint the author happens to be standing at. The second half of the reading is
# the non-vacuity check: in this state the two distances really do differ, so a pass that reached for the
# live camera would be reported here rather than admired.
qa_ok 'the picture is fogged at its own eye distance, not at the standpoint the author is standing at' \
  "$(qa_jsv '(()=>{const p=__me.qa.images().projection,f=(d)=>Math.abs(p.fog[0]-(d+40))<0.001&&Math.abs(p.fog[1]-(d+200))<0.001;return [f(p.dist), Math.abs(p.dist-__me.qa.realized().dist)>0.001&&f(__me.qa.realized().dist)].join("|");})()')" 'true|false'
# The World a picture was drawn from can change under it: the World writers mutate the museum in place, so
# the generation a picture is keyed on is the history's own settle point, not the museum's object identity.
# An accepted write through that authority (the same writer and history seam the wall-top control calls) must
# move the generation, and selecting the View again must draw rather than serve the picture of the old World.
qa_js "(window.ux0.coldUrl = document.querySelector('[data-exp-preview=\"$use_cold\"] [data-exp-preview-image]').src, true)" >/dev/null
world_before="$(qa_jsv '__me.qa.images().world')"
drawn_before="$(qa_jsv '__me.qa.images().drawn')"
# The write's own result is read from the model, not from an expected shape typed into this axis.
wtop() { qa_jsv 'JSON.stringify(__me.ctx.museum.walls.find((w) => w.id === "rotunda").top)'; }
top_before="$(wtop)"
qa_js "(__me.A.setTopForm('rotunda', 'gable'), true)" >/dev/null
top_after="$(wtop)"
[ "$top_after" != "$top_before" ] && wrote=true || wrote=false
qa_ok 'an accepted World write moves the generation every held picture is keyed on, and really lands in the model' \
  "$(qa_js "(__me.qa.images().world || '') !== '$world_before'") / $(qa_js '__me.ctx.museum.walls.find((w) => w.id === "rotunda").top.form === "gable"') / $wrote" \
  'true / true / true'
tap "#index [data-act=exp-open][data-id=\"$pid\"]"
pick "$(row "$use_cold")" >/dev/null
wait_image "[data-exp-preview=\"$use_cold\"] [data-exp-preview-image]" || qa_fail_msg "the preview never re-drew for $use_cold after the World write"
# How many pictures the write costs depends on how many Cards were open when the World moved, so the count is
# read rather than assumed; what cannot vary is that the stale picture is not served — a pass keying on the
# museum's own object identity would serve it, draw nothing here and leave the same src in place.
drawn_written="$(qa_jsv '__me.qa.images().drawn')"
redrawn=$((drawn_written - drawn_before))
qa_ok 'the View whose World changed is drawn again from the new World, never served the old picture' \
  "$([ "$redrawn" -ge 1 ] && echo true || echo false) / $(qa_js "document.querySelector('[data-exp-preview=\"$use_cold\"] [data-exp-preview-image]').src !== window.ux0.coldUrl") / $(qa_js '__me.qa.images().queued === 0')" \
  'true / true / true'
qa_say "qa: World write · $redrawn picture(s) re-drawn, cache $(qa_jsv '__me.qa.images().cached') · the picture of the old World was not served"
# Failure: the draw is refused at the Stage's own seam. A refusal must leave a named reason where the picture
# would be, keep the live page intact, and not be retried every turn; with the renderer back, the refusal is
# still remembered rather than the View being quietly redrawn behind the author. Statements must be one
# expression here: the harness awaits whatever it is handed, and a bare statement list is a syntax error it
# would report as an empty observation.
qa_js "(() => { window.ux2Real = __me.ctx.stage.snapshotPose; __me.ctx.stage.snapshotPose = () => null; return true; })()" >/dev/null
tap "#index [data-act=exp-open][data-id=\"$pid\"]"
fail_pre="$(pick "$(row "$use_fail")")"
for _ in $(seq 1 12); do
  qa_frames
  [ "$(qa_js "!!document.querySelector('[data-exp-preview=\"$use_fail\"] [role=status]')")" = "true" ] && break
done
qa_ok 'a refused draw leaves a named reason where the picture would be, and no image pretending to be one' \
  "$(qa_js "document.querySelector('[data-exp-preview=\"$use_fail\"] [role=status]')?.textContent?.includes('Camera preview unavailable')") / $(qa_js "document.querySelector('[data-exp-preview=\"$use_fail\"] [data-exp-preview-image]')===null")" \
  'true / true'
qa_js "(() => { __me.ctx.stage.snapshotPose = window.ux2Real; return true; })()" >/dev/null
qa_frames
qa_ok '…the live authoring state is intact, the refusal is remembered, and nothing was drawn for it' \
  "$(qa_jsv 'window.ux0.passState()') / $(qa_js "document.querySelector('[data-exp-preview=\"$use_fail\"] [data-exp-preview-image]')===null") / $(qa_jsv '__me.qa.images().drawn')" \
  "$fail_pre / true / $drawn_written"


qa_say "-- the narrow review size keeps the same laws"
agent-browser set viewport 1024 768 >/dev/null
qa_frames
tap '#experienceDeck [data-act=exp-close]'
stage_before="$(qa_jsv 'window.ux0.stageRect()')"
narrow_before="$(qa_jsv 'window.ux0.fingerprint()')"
qa_ok 'at 1024×768 the Index and Card leave the columns for the sheets entry, and the homes stay singular' "$(qa_jsv 'JSON.stringify(window.ux0.homes())') / $(qa_jsv 'JSON.stringify({ index: document.querySelector("[data-home=index]").checkVisibility(), card: document.querySelector("[data-home=card]").checkVisibility(), sheets: [...document.querySelectorAll("[data-act^=sheet-]")].filter((b) => b.checkVisibility()).length })')" '{"head":1,"index":1,"stage":1,"card":1,"deck":1,"preview":1} / {"index":false,"card":false,"sheets":2}'
# The same law at the narrow size, where the Index is an invoked sheet rather than a column: the rows it
# shows there are the rows above, in a box narrower than any of them is written for. Invoked and closed
# again before the Card's own sheet, so neither sheet's state is borrowed by the other.
tap '[data-act=sheet-index]'
qa_ok 'the narrow Index sheet paints the same lines without overlap, overflow or escape' \
  "$(qa_jsv 'window.ux0.indexLineLaw()')" 'true|true|true|true|true'
qa_say "qa: Index sheet at 1024×768 · $(qa_jsv 'JSON.stringify(window.ux0.indexText())')"
tap '[data-act=sheet-index]'
tap '[data-act=sheet-card]'
qa_ok 'an invoked sheet resizes nothing and writes nothing' "$(qa_jsv 'window.ux0.stageRect()') / $(qa_jsv 'window.ux0.fingerprint()')" "$stage_before / $narrow_before"
tap '#experienceDeck [data-act=exp-guide]'
narrow_band="$(band)"
qa_ok 'the narrow band stays in the reserved share, in one home, heading reachable, nothing scrolling inside it' "$(band_law "$narrow_band")" 'True|True|True|True|True'
qa_ok 'invoking the Card sheet never closes the band to pass a Card test' "$(qa_jsv 'JSON.stringify([!!window.ux0.deck(), document.querySelector("[data-home=card]").checkVisibility()])')" '[true,true]'
qa_snap 'experience-shell-1024-guide'

qa_faults_ok 'no command or page faults'
qa_browser_errors_ok 'no console or page errors'
qa_summary "PR #114 · Experience shell ($LABEL)"
