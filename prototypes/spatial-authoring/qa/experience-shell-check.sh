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
  // UX1: the shell has one Preview control, and every control that can start a visit is inside it.
  const previewOutside = () => [...document.querySelectorAll('[data-act^=exp-preview]')]
    .filter((b) => !document.querySelector('#headPreview').contains(b)).length;
  return { reachable, homes, deck, band, cardIdentityReachable, fingerprint, stageRect, previewOutside };
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
qa_click '#headPreview > summary' >/dev/null 2>&1
qa_preview_presentation || qa_fail_msg 'the Head Preview menu did not start the Presentation scope'
qa_ok 'the menu closes behind the visit it started' "$(qa_js 'document.querySelector("#headPreview").open')" 'false'
qa_ok 'Preview hides every authoring home and unmounts the Deck' "$(qa_jsv 'JSON.stringify({ preview: document.querySelector("[data-home=preview]").checkVisibility(), head: document.querySelector("[data-home=head]").checkVisibility(), index: document.querySelector("[data-home=index]").checkVisibility(), card: document.querySelector("[data-home=card]").checkVisibility(), deck: document.querySelectorAll("[data-home=deck]").length, presenter: document.querySelector("#experienceExamples").checkVisibility() })')" '{"preview":true,"head":false,"index":false,"card":false,"deck":0,"presenter":false}'
qa_ok 'exactly one Exit Preview, and no authoring writer or nested home inside the visitor surface' "$(qa_jsv 'JSON.stringify([[...document.querySelectorAll("[data-act=exp-exit-preview]")].filter((b) => b.checkVisibility()).length, !!document.querySelector("[data-home=preview] [data-home]"), !!document.querySelector("[data-home=preview] [data-exp-primary]"), !!document.querySelector("[data-home=preview] [data-act=exp-capture]")])')" '[1,false,false,false]'
qa_snap 'experience-shell-1440-preview'
tap '[data-act=exp-exit-preview]'
qa_ok 'leaving Preview restores the exact authoring context: same source, history, selection, standpoint and Deck posture' "$(qa_jsv 'window.ux0.fingerprint()') / $(bandof posture)" "$context_before / $preview_posture"

echo "-- the narrow review size keeps the same laws"
agent-browser set viewport 1024 768 >/dev/null
qa_frames
tap '#experienceDeck [data-act=exp-close]'
stage_before="$(qa_jsv 'window.ux0.stageRect()')"
narrow_before="$(qa_jsv 'window.ux0.fingerprint()')"
qa_ok 'at 1024×768 the Index and Card leave the columns for the sheets entry, and the homes stay singular' "$(qa_jsv 'JSON.stringify(window.ux0.homes())') / $(qa_jsv 'JSON.stringify({ index: document.querySelector("[data-home=index]").checkVisibility(), card: document.querySelector("[data-home=card]").checkVisibility(), sheets: [...document.querySelectorAll("[data-act^=sheet-]")].filter((b) => b.checkVisibility()).length })')" '{"head":1,"index":1,"stage":1,"card":1,"deck":1,"preview":1} / {"index":false,"card":false,"sheets":2}'
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
