# Round 2 design extraction and proposed production specification

**Proposed; not implemented or visually accepted.** Exact wireframe values are
identified separately from production adaptations. Departures are registered in
[the gap analysis](./gap-analysis.md#departures-and-owner-decisions).

## 1. Measurement sources

| Source | What was extracted |
| --- | --- |
| [styles.css](../../../../prototypes/production-shell-wireframe/styles.css) | Actual tokens, typography, borders, shadows, control dimensions, responsive container queries and state selectors |
| [chrome.js](../../../../prototypes/production-shell-wireframe/chrome.js) | Head ordering, inline Find, scoped Index, Card primary/advanced fields and contextual actions |
| [tools.js](../../../../prototypes/production-shell-wireframe/tools.js) | Dock order, palette order, explicit collapse, upward disclosures and Library |
| [stage.js](../../../../prototypes/production-shell-wireframe/stage.js), [manip.js](../../../../prototypes/production-shell-wireframe/manip.js) | Sheet placement, screen-space glyph dimensions and subject-specific anchors |
| [icons.js](../../../../prototypes/production-shell-wireframe/icons.js) | Actual SVG paths, viewBox, sizes, strokes and caps |
| [app.js](../../../../prototypes/production-shell-wireframe/app.js), [core.js](../../../../prototypes/production-shell-wireframe/core.js) | Scope changes, palette lifetime, Escape priority, responsive threshold and state defaults |
| [Atlas](../../../../prototypes/production-shell-wireframe/atlas.html), [presets](../../../../prototypes/production-shell-wireframe/atlas.js), [tours](../../../../prototypes/production-shell-wireframe/tour.js) | Rest/open/collapsed/hover/drag/detail states; recommended versus retained alternative treatments |

Browser computed styles confirmed the principal values, rather than estimating
them from the owner's screenshots. Example at 1440 × 900: Head 44 px; Index
256 px; compact selected Wall Card 288 × 148.97 px; Ink column 42 × 181 px;
seven-key Dock 313 × 50 px. Card height is content-dependent, not a fixed token.
The Ink column's first ellipsis key is 18 px high; ordinary pen keys are 32 px.

## 2. Actual color tokens

These are literal `:root` values, including case-normalized equivalents.

| Family | Exact tokens |
| --- | --- |
| Forest | `forest #11291f`; `forest-2 #22503c`; `forest-3 #2d5e48` |
| Leaf | `leaf #4f8f6c`; `leaf-tint #e7f1ea` |
| Gold | `gold #d4ad45`; `gold-ink #74560c`; `gold-tint #f8efd6` |
| Working surfaces | `ivory #f3f0e4`; `card #ffffff`; `index #f6f7f5`; `paper #e9ebe6`; `mat #1d3a33` |
| Text | `ink #1b201c`; `ink-2 #4a524c`; `ink-3 #79817b` |
| Dividers | `hair #e1e4de`; `hair-2 #cdd2ca` |
| Warning/refusal | `caution #c85a48`; `caution-bg #f7ede8`; `refuse #7e2718`; `refuse-bg #fdf3f0` |
| Other semantic ink | `slate #56707c`; Ink `#1b201c`; Slice `#f2d000`; Eraser `#d0412d` |
| Prototype-only tour | `#2f8cff` — exclude from product chrome |

Additional painted values matter; replacing them all with the nearest base token
would change the design:

| Element | Actual treatment |
| --- | --- |
| Head text / utility icon | `#eef1ec` / `#dfe6df`; project title `#fff` |
| Resting Find | White at 10% over forest; search ink `#b9c8bd`; placeholder/keycap `#9fb2a5` |
| Open Find | White surface; input `ink`; search icon `ink-3` |
| Lens segment | Black at 25%; resting text `#cfd8d0`; selected key `#e9ebe6`, forest text |
| Head hover / separator | White at 8% / 14% |
| Light Stage furniture | White at 94%; 1 px `hair` border |
| Dark furniture in original 3D mock | `rgba(14,30,25,.8)`; border white at 10%; text `#e7ece7` |
| Dock / palette | `rgba(17,41,31,.95)`; 1 px white-at-9% border |
| Dock icon / palette icon | `#e6ece6` / `#d9e2da`; palette hover white |
| Palette selection | Ivory at 14%; inset 1 px ivory-at-55% edge; not a solid ivory key |
| Popup/secondary flyout | White / forest at 97%; muted text `#9fb2a5` on forest |
| Precision input | `#fafbf9`; hover border `hair-2`; focus white with leaf border and 2 px leaf-at-25% halo |
| Compact value tag | `rgba(10,24,18,.82)`; white text |
| Paper grid | Minor `rgba(159,178,162,.4)`; major `rgba(128,153,132,.55)`; 1 px non-scaling lines |
| Original dark grid | Minor `#2b5147`; major `#3c6a5c`; 1 px lines — do not restore a green grid over the retained Paper workspace |

**Production adaptation:** keep the unified bounded Paper workspace in 2D and 3D,
with committed-geometry-only extents and a solid forest exterior. Proposed exterior
shade is the wireframe's `mat #1d3a33` (current code uses `#152c26`); this is a
paint change, not restoration of the all-green mock ground. Restore the source's
light 2D / dark-glass 3D drafting families; the retained light 3D ground does not
require replacing that control hierarchy. Authored 3D materials are preserved.

## 3. Typography, glyphs and surface language

| Role | Exact wireframe specification |
| --- | --- |
| Base | `13px / 1.35`, `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| Serif | `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif` |
| Monospace | `ui-monospace, "SF Mono", Menlo, Consolas, monospace`; tabular numerals |
| Project name | 15 px serif, normal weight; maximum 180 px; single-line ellipsis |
| Lens / Find input | 12.5 px sans; selected lens weight 600 |
| Index breadcrumb / row / metadata | 12 px / 13 px / 11 px sans |
| Index section heading | 10 px, weight 600, uppercase, `.07em` tracking |
| Card kicker / name | 11 px `ink-3` / 19 px serif, weight 400, line-height 1.2 |
| Dimension label / input | 10.5 px `ink-3` / 12 px mono |
| Card More / relations | 11.5 px / 12 px sans |
| Sheet value / tag | 10.5 px mono weight 600 / 11 px mono |
| Keycap | 10 px mono; 0–4 px horizontal padding; 1 px `hair-2`, radius 4 px |
| General icon | `viewBox="0 0 24 24"`, default rendered 18 px; no fill; stroke 1.6, round caps/joins |
| Head search / Preview / Card actions | 15 px icons; hamburger and history use default 18 px |
| Dock / palette | Dock icon 18 px, Objects icon 19 px; palette icon 16 px; CSS stroke override 1.35 |
| Generic focus | 2 px `forest-2` outline, offset 1 px, 4 px white-at-90% halo, radius 6 px |
| Standard raised surface shadow | `0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.12)` |
| Furniture shadow | `0 1px 2px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.07)` |
| Dock shadow | Inset `0 1px 0` white at 5%, plus `0 10px 28px` black at 28%; backdrop blur 8 px |
| Palette shadow | `0 10px 24px rgba(0,0,0,.25)` |

The live CSS focus treatment is green plus a white halo. The design note's phrase
“blue ring” does not describe that implementation; blue is used by the prototype
tour. Production should use the actual shell focus treatment and verify its
contrast, rather than importing tour styling or using gold for ordinary focus.

## 4. Layout and control measurements

All measurements below are CSS px, border-box. These are the fine-pointer baseline.

| Part | Exact baseline geometry and alignment |
| --- | --- |
| App | Head row 44; remaining height is Stage/body; collapsed Index occupies zero width |
| Head | Horizontal inset 8; gap 6; centered single row |
| Head utility key | 32 × 30, radius 7; no permanent border |
| Lens segment | Padding 2, radius 8; keys height 26, horizontal padding 11, radius 6 |
| Location chip | Height 28, padding 0–10, gap 6, radius 8, maximum width 320 |
| Find | 250 × 30 resting; open width 330; padding 0–8, gap 6, radius 8 |
| Find results | Width 330; top 40, right 150 relative to app; radius 10; padding 4; max-height 420; rows padding 5–8, gap 8, radius 6 |
| Preview | Height 30; padding 0–11; gap 6; radius 8; gold fill, `#2a2208` ink, weight 600 |
| Head separator / saved indicator | 1 × 18 with 2 px side margin / 22 px indicator slot |
| Proposed real Save control | Production adaptation: use one 32 × 30 utility key/status slot, 18 px family icon, truthful accessible state; saved check may use source 14 px glyph. Do not add a second permanent save/status button |
| Index | Width 256; square edge; right border 1 px `hair`; no freestanding rounded slab |
| Index header / filter | Header padding 8 top, 6 right, 6 bottom, 8 left; gap 4. Filter height 28, padding 0–7, gap 6, radius 7 |
| Breadcrumbs | Padding 0–10–6; gap 2 vertically, 3 horizontally; crumb keys padding 2–4, radius 5 |
| Facets | Margin 0–8–4; padding 2; gap 2; radius 7; keys height 24, radius 5 |
| Index row | Minimum 28; text-button padding 4 top/bottom, 6 right, 10 left; icon gap 7; no pill border |
| Row context / scope entry | Scope chevron 26 × 26, radius 6, right margin 4; selected row gold tint, selected name weight 600 |
| Stage top-left | Top 10, left 10 from Stage; gap 6 |
| Reading family | Glass radius 9, 1 px hairline; padding 2, gap 1; keys height 28, min-width 34, padding 0–8, radius 7; selected `forest-2` with white ink |
| Reading disclosure | 26 px minimum width, padding 0–5 in wireframe; proposed gear replaces its chevron in the same slot |
| Grid / Snap | Separate shared glass family, height 32, padding 0–2; keys height 26, padding 0–7, radius 6; off opacity .5 plus strike-through |
| Card | Top 10, right 10; right 58 with Sheet on right; width 288; radius 12; 1 px hairline; content-height, overflow only when necessary |
| Card inner spacing | Header padding 7 top, 6 right, 0 bottom, 12 left; title margins 0–12–6; dimensions padding 0–12–8 |
| Dimensions | Auto-fit columns, minimum 58; gap 6; label-to-input gap 2; input height 26, padding 0–6, radius 6 |
| Card footer | Padding 4 top, 8 right/bottom, 10 left; gap 4; top 1 px hairline; action icon keys 24 × 24; More height 24, padding 0–7 |
| Card advanced section | Padding 8–12; 1 px top divider; relation rows padding 2–0; no second copy of primary facts in proposed production |
| Height Sheet | Right 10, top 56, bottom 76 from Stage; width 40; transparent container; no capsule around track |
| Sheet line / knob | Line 2 px wide, radius 1; white-at-28% on dark, ink-at-20% on Paper. Knob min-width 40, height 22, radius 11, padding 0–5; `#fbfaf2` fill, shadow `0 1px 4px` black at 35% |
| Sheet marks | Surface tick 10 × 1.5; Level tick 22 × 2.5; pin dot 8 diameter; tick hit box 22 × 12 in mock |
| Pin affordance | 20 × 20 circular key immediately 3 px left of knob; pin glyph 12; neutral dark backing and white ink |
| Lower edge | Left/right 12; bottom 10; gap 8; centered on Stage, not on the residual area beside a 138 px Sheet lane |
| Dock | Padding 4; gap 2; radius 14; seven-key wireframe width 313, height 50 |
| Dock key | 40 × 40, radius 10; active ivory with forest icon and `0 1px 3px` black-at-25% shadow |
| Tool accent | 14 × 2 mark centered under icon, bottom 3 (4 when active), opacity .9; not a green underline on Select |
| Dock divider | 1 × 22; margin 0–4; white-at-12% |
| Ink palette | 42 px outside width; bottom of column 8 above its own key; centered over that key; padding 4–4–2; gap 2; radius 12 |
| Palette keys | 32 × 32, radius 8; top ellipsis height 18; foot collapse key 32 × 16, radius 6, margin-top 1 |
| Collapsed palette cue | 10 × 5 ivory triangle; top −7 relative to key slot; opacity .55, 1 on hover; pointer-events none |
| Secondary flyout | Upward from palette, 8 px gap; 176 px wide, padding 6, radius 12; brush picker variant 216 wide, padding 8 |
| Library instrument | `min(480px, 100%)` wide; forest, radius 12; header padding 6 top/right/bottom and 12 left; body 8 top, 12 sides, 10 bottom |
| Library tile | Grid columns `minmax(72px,1fr)`, gap 6; tile padding 6, gap 4, radius 8, transparent 2 px border; white working surface, 32 px glyph area, 11 px/600 label |
| Plan ruler | Bottom/left 12; 11 px mono; 2 px label gap; 5 px-high rule with 1.5 px bottom/end strokes. Mock measures a fixed 5 m; production retains evaluated adaptive length (E19) |

Production collision logic must account for the Card and Sheet without recreating
the current 138.39 px permanently reserved Sheet lane. Compact fields, neutral
ticks and transient labels remove the reason for that lane.

## 5. Disclosure and interaction behavior

| Surface | Required behavior |
| --- | --- |
| Head | Hamburger toggles Index, per current owner ruling. Project title keeps its existing project-action disclosure. No separate brand word or framed Index word-button. Undo/Redo are labeled icon controls. Save state remains truthful; an unsaved project must not acquire the mock's permanent “Saved” check |
| Find | Inline input on desktop; focus/⌘K opens suggestions; query stays visible; Up/Down highlights, Enter invokes, Escape closes and returns focus. Use distinct verbs: Select a subject, Go to a scope, Arm a tool, Run a command. No automatic selection or Camera move while filtering |
| Index | Scope/facets, not a document tree. Breadcrumb changes scope; sibling disclosure switches equivalent available contexts; row selects; its chevron enters spatial context. Shared Walls can appear in both related Room scopes with the same canonical selection identity. Selection alone does not change scope |
| Card | Identity, a few primary dimensions and compact Look actions. Straight Wall: Length + Height. Opening: Width + Height + Sill. Only current supported operations are editable; a curved Wall must not acquire a fictitious length writer. Room-floor: one derived area fact with truthful Floor identity. Rename appears only when the title/action is invoked. Existing Card More reveals precision and relations; its context ellipsis holds subject actions. No default diagnostic paragraph, full coordinate form, permanent Delete or generic future-task controls |
| Numeric editing | Preserve parsers and units. Compact resting text uses existing measure formatting, not unbounded floating-point strings; focus reveals the accepted precision without quantizing it. Enter commits; Escape/blur keep the existing discard policy; refusals stay next to the field. Disclosure changes do not create history or silently commit/discard a live proposal |
| Ink | One compact column over armed Ink. Choosing Line/Box keeps it open. Pressing Ink again, collapse chevron or appropriate Escape collapses it while retaining tool/options. First Escape resolves active edit/stroke according to existing cancellation policy; only a subsequent level collapses/disarms. No permanent Point/Options/Pending/counter/Finish text row |
| Precision during drawing | Current gesture typing, Enter, Backspace and cancellation stay. Explicitly requested Point and tool parameters appear in one anchored upward disclosure; live value/refusal belongs beside the gesture. See E6 for the proposed explicit Opening access, since the mock's contextual interpretation is not production functionality |
| Sheet | Line, value knob and ticks; labels on focus/hover/drag, not permanent technical badges. Pin creation/removal remains session state. Preserve slider arrows, PageUp/PageDown, Home, pointer capture, touch and interruption behavior. Add the mock's invoked numeric value editing through the existing height setter |
| Unavailable UI | Small accessible disabled placeholders may preserve composition; they never arm a tool or create geometry. Source Dock disabled opacity is .35. Proposed unavailable Preview retains gold fill at .45 overall opacity (from the source's disabled action family), stays `aria-disabled`/focusable and explains why on focus/tap; no fake visitor entry. This state is an adaptation, not a measured mock Preview state (E13) |
| Zoom / Fit | Remove persistent cluster. Preserve wheel/pinch and F Fit. Expose actual Zoom in/out and Fit functions through Find; add guarded +/− keyboard access because current code has no keyboard zoom command |
| Objects / Library | Preserve real native Shapes, catalogue, My Objects and import. Apply the source's bounded instrument/tile language; precise initial placement is invoked via a scoped Find command, not permanent X/Z writers. Do not copy mock assets, material/Art tabs or sample-import success (E21) |
| Return | Scope, palette, Card detail and height are session view state. None belongs in authored documents. Resizing or opening chrome must not implicitly refit or replace Camera evaluation |

## 6. Spatial ink and gizmos

These are **visible glyph** dimensions; hit geometry remains separate.

| Mark | Exact wireframe drawing |
| --- | --- |
| Ordinary 3D edge | 1 px, round joins, non-scaling stroke |
| Selected 3D geometry | 3 px gold outline; mock substitutes `#e9d79c` at .82 fill opacity. Production proposal preserves materials beneath a gold overlay (E10) |
| Paper Wall | Physical-thickness polygon filled `ink`, same ink .5 px contour; non-scaling stroke |
| Selected Paper Wall | Gold polygon fill, 2 px `gold-ink` outline. This is a whole cut band, not two thick gold strips over a black center |
| Hover | Leaf contour 2.5 px; selected identity remains higher priority. Production neutral hover is a registered later-state choice (E11) |
| Ray / halo | Foreground white, 1.3 px, opacity .92, dash `4 3.5`, round caps; under-stroke `rgba(8,22,16,.38)`, 3.4 px |
| Paper ray / halo | Foreground `ink`; under-stroke white at .7 — the live code reverses the dark-ground pair |
| Arrowhead | Open V, length 6.5; half-width `6.5 × .62`; foreground 1.5 px, halo 3.6, round caps/joins. Two-way arrowheads use length 5.5 |
| Anchor | General point radius 4.2 with halo radius +1.6; Wall endpoint radius 4.6; outline 1 px dark-at-55%; no gold knob disk |
| Hover / active | Ray 1.8 px, arrowhead 2; active ray becomes solid, rotation ring stays dashed. The live CSS uses ivory points/gold-ink edges on hover/hold, while the Atlas illustrates a gold active point (E11) |
| Rotation / move / scale | Ring minimum projected radius 30; dash `3 4`; move cross 2–11 px from base center; proportional scale point radius 4, with a short ray. Width/depth/height rays appear after scale-point invocation |
| Object dimension rays | Reach max of 26 or distance past ring +16; height ray 40; opposite face stays fixed for the mock's per-face operation |
| Wall | Base endpoint points; 38 px top ray in 3D; two-way base half-length 18 in Plan / 15 in 3D; thickness arrow at one-quarter cap length, half-length 9 |
| Opening | Faint full-host track, dash `1.5 5`, opacity .6; slide point radius 4.4, local arrowheads at ±14; width rays 18; head ray 22; sill ray 20 only when meaningful |
| Values | Hover/drag only; dark 20 px-high tag, radius 5; 11 px mono; tag offset 12 right, 10 up from active tip; no persistent W/D/H or raw identity |
| Invisible targets in mock | Point radii generally 11–13; ray hit band 14. Production keeps at least 22 fine / 44 coarse targets with non-overlapping arbitration |

Apply these treatments to existing canonical drawing sets and the one projected
Stage mark vocabulary. Do not replace Layout geometry, Plan membership/picking,
Camera projection, authored material identity or F4 acceptance. Existing Wall
height/thickness planners can support additional input bindings; atomic two-sided
Opening resizing and support-aware object resizing are separate capability limits,
not CSS defects. See E8/E9.

## 7. Responsive extraction and production adaptation

| Width/state | Actual wireframe behavior |
| --- | --- |
| 1440 × 900 and 1280 × 800 | 44 px Head, docked 256 px Index when open, 288 px Card; Find 250/330 resting/open |
| 1180 × 820 | Same source rules as above: 1180 is greater than 1100. The Atlas caption says Index collapsed by default, but live `renderFrame()` does not establish that default at this width |
| At or below 1100 | Entering this range collapses Index; reopening produces an overlay; project title hidden; Find 190/280; Card 264 |
| At or below 860 (including 820 × 1180) | Preview text hidden; Find resting width 150, keycap hidden; location chip max 180; Card 248. Open Find retains the ≤1100 declared 280 width and may flex-shrink when the Head is crowded |
| Overlay | Index bottom and scrim stop 66 px above the body bottom; bottom-right radius 12; scrim black at .12; tools remain reachable |
| Simulated frame caveat | Width-menu/Atlas presets cap simulated height to `window.innerHeight - 40`; measure actual viewport dimensions with `width: fill`, not a clipped simulation |

Restore the actual ≤1100 and ≤860 composition thresholds. At 1180 the owner can
close Index explicitly; do not silently adopt the caption over the live build.
An overlay's lower boundary must clear the *actual* touch Dock height when larger
than the mock's 66 px reserve. Index scope must survive both docked and overlay modes.

**Accessibility adaptation:** retain 44 × 44 coarse-pointer interaction targets,
keyboard focus, labels and truthful unavailable reasons. Visible glyphs/plates stay
compact inside those targets. Adjacent hit areas must not overlap; palette rows
may consequently occupy 44 px on touch and the Dock may grow vertically. Remove
the current blanket “all inputs/buttons become 44 px” rule only after equivalent
scoped targets exist. These necessary touch changes are E12, not an invented
second visual treatment.
