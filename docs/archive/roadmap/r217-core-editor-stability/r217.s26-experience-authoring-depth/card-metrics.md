# R217.S26–S30 — Experience Card metrics

**Status:** planning reference for S26–S30 writers. It is not a reference contract and does not
restyle the Round 2 shell or the compact Guide. The
[shell and visual-system contract](../../../../reference/design-system/editor-shell-and-visual-system.md)
and `apps/editor/src/lib/authoring/stage/shell/shell-roles.css` win wherever this sheet disagrees.

**What it does.** It gives each Experience Card interior and control the plan names across S26–S30 a
layout, size, spacing and type role at the production Card width. Conservatory
(`prototypes/experience-ux-alternative/styles/{tokens,components,visitor}.css`, `app/main.js`) supplies
content and proportion. Round 2 (`prototypes/production-shell-wireframe/styles.css`, `exp.js`) and the
landed `EditorCard.svelte` supply the shell metrics.

## 1. Scale

| Quantity | Conservatory | Production | Rule |
| --- | --- | --- | --- |
| Card width | `--card-w` 324 px | `--shell-card-width` 288 px | Fixed by the shell. |
| Side padding | 18 px | 12 px (landed `.facts`, `.subject-actions`) | Use the shell value. |
| Content width | 288 px | 264 px | Interior ratio ≈ 0.92. |
| Body / utility / identity type | 13 / 12 / 15 px | `--shell-text-body` 13, `--shell-text-utility` 12, `--shell-text-identity` 15 | 1:1. Type does not scale. |
| Title | 23 px display | 19 px `--shell-serif` (landed `.name`) | Use the shell value. |
| Kind line / kicker | 11 px caps, 600 | 11 px, `--shell-ink-3` (landed `.kind`) | Use the shell value. Production does not use the caps kicker. |
| Control height | `--ctl-h` 30, `--ctl-h-lg` 36 | 28 px in the Card, `--shell-control-height` 30 px in the Head and dock | Card controls are 28 px. |
| Small control | `.btn.xs` 26, `.seg.sm` 24 | 24 px | Rounds to the shell's 4 px grid. |
| Radius | `--r-sm` 6, `--r-md` 9, `--r-lg` 14 | 6 / 8 / 12 (Card shell 12) | Snap to the landed radii. |
| Coarse pointer | none | 44 px min-height on every control | Shell coarse-target rule. |

Lengths that hold content, such as thumbnails and grid tracks, scale by ≈ 0.92 to the content width. Type,
control heights and hairlines do not scale.

## 2. Colour roles

| Meaning (Conservatory token) | Shell role |
| --- | --- |
| Attention, selection, playhead, visitor's eye (`--gold-*`) | `--shell-gold`, `--shell-gold-tint`, `--shell-gold-ink` |
| Forest emphasis, numbers, entry tag (`--forest-700/800`) | `--shell-forest`, `--shell-forest-raised` |
| Leaf hover and pressed (`--leaf-100/300`) | `--shell-leaf-tint`, `--shell-leaf` |
| Text 1 / 2 / 3 | `--shell-ink`, `--shell-ink-2`, `--shell-ink-3` |
| Line, line-strong | `--shell-hairline`, `--shell-hairline-strong` |
| Danger (`--danger`, `--danger-tint`) | `--shell-refuse`, `--shell-refuse-bg`; `--shell-caution` only for a recoverable warning |
| Raised surface | `--shell-card` (#fff), `--shell-control-surface` |
| Dark glass (deck, mode pill, visitor) | `--shell-glass-dark`, `--shell-popup-dark`, `--shell-ink-light`, `--shell-ink-quiet` |
| Tags and numbers in mono | `--shell-mono` |

## 3. Card interiors

Sections inside a writer use the landed Card rhythm: 12 px side padding, a 1 px `--shell-hairline` rule
between sections, 10 px above and 6 px below each section heading, and headings at 12 px / 600 / `--shell-ink`
with an optional mono count at 10 px / `--shell-ink-3`.

### 3.1 Presentation (S26 landed; S28 completes)

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| View grid | 2 columns, `minmax(0,1fr)` | gap 8 px row, 6 px column (landed); tile image 16:10, radius 8 | Name 12 px / 500, ellipsis |
| Dense grid (≥ 9 Views or the filter on) | 3 columns | gap 6 px; image 4:3, radius 6; Default badge shows the icon only | Name 11 px |
| Default badge on a tile | absolute, 4 px inset | 16 px high, radius 8, padding 0 5 px, `--shell-value-surface` | 10 px mono, `--shell-gold` |
| Filter row | flex, gap 6 | field 28 px; chips 24 px, radius 12, padding 0 8 | 11 px / 600 |
| Reorder caret | 3 px bar before or after a tile, radius 2 | `--shell-gold` (landed, the Stop cards' caret) | — |
| Refused reorder note | after the grid | margin-top 6 | 11 px `--shell-ink-2` |

### 3.2 View (S26 landed parts; S28 completes)

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Hero | full content width, 16:10 (264 × 165) | margin 10 px 0 4 px, radius 8, inset 1 px hairline | — |
| Hero tag (lens · eye height) | absolute right 6, bottom 6 | 18 px high, padding 0 7 px, radius 9, `--shell-value-surface` | 10 px mono, `--shell-ink-light` |
| Lens step | `.field` row: label left, segmented control right | row min-height 32; segments 24 px, padding 0 7 px, 2 px track inset | Label 12 px `--shell-ink-2`; segment 11 px / 500; pressed is white with `--shell-leaf` inset |
| Eye step | same as Lens | same | same |
| Framing foot note | below the steps | margin-top 8 | 11 px `--shell-ink-3` |
| *Also in* (S26) | wrapped inline links | gap 4 px 8 px | 12 px; link `--shell-forest` |

At 264 px the Lens step's four segments (about 4 × 46 px) fit beside a 12 px label without wrapping.
With five segments the label goes above the control.

### 3.3 Stop (S26 *Start*; S27 guided Views)

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Shot-list row | flex: grip, number, thumb, main, remove | min-height 42; gap 6; padding 4 px 4 px 4 px 2 px; radius 8; 1 px hairline | — |
| Number | 14 px wide | — | 12 px / 600 `--shell-forest`, tabular |
| Thumb | in-Stop 52 × 36; out 46 × 30 | radius 5 | — |
| Name and meta | column, gap 2 | hold stepper 22 px (buttons 20 × 20) | Name 12 px / 500; meta 11 px `--shell-ink-3` |
| Entry tag | inline after the name | padding 1 px 5 px, radius 4, `--shell-forest` | 10 px mono caps, white |
| *Start* tag (S26, landed) | in stop-meta | — | 10 px mono (`500 10px --shell-mono`) |
| Remove ✕ | 24 × 24 | 0.55 opacity, full on hover or focus | — |
| Dragging | — | `--shell-gold` border, Card shadow | — |
| *Not in this Stop* | disclosure, then the same rows dashed and transparent | disclosure 28 px; collapsed past 4 Views | 12 px / 600 `--shell-ink-2`, count 11 px `--shell-ink-3` |
| *After this Stop* | one row, `--shell-leaf-tint` with a 1 px leaf-tint-strong border | padding 8 px 10 px, radius 8, gap 6 | Label 11 px `--shell-ink-2`; Stop chip 24 px, radius 12, 12 px / 600 |

### 3.4 Transition (S29)

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Ends | grid `1fr auto 1fr`, gap 6 | margin-top 10; end image 16:10 (≈ 116 × 72), radius 8, number at 5 px inset | Caption 11 px `--shell-ink-3`; name 12 px / 600, ellipsis |
| Middle (kind, duration) | column, centred | — | 11 px / 600 `--shell-leaf` |
| Movement section | `.field` rows | row min-height 32; segmented 24 px | Label 12 px `--shell-ink-2`; value 12 px tabular |
| Warning | block | padding 8 px 10 px, radius 8, `--shell-caution-bg` | 12 px, ink `--shell-caution` |
| Selected point bar | flex, space-between | padding 4 px 4 px 4 px 10 px, radius 8, `--shell-gold-tint`, 1 px gold inset | 12 px `--shell-gold-ink`; remove is a 24 px refuse ghost |

### 3.5 Guide (S26 *opens*; S27 mode cards)

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Mode cards | grid, gap 6; each a 2-column grid (icon, text) | padding 10 px, radius 12, 1 px hairline; icon 20 px; column gap 8 | Title 13 px / 600; line 12 px / 1.45 `--shell-ink-2` |
| Mode card hover or chosen | — | `--shell-gold` border | — |
| *opens* tag (S26, landed) | inline | — | 10 px mono |
| *Make this the opening Guide* (S26, landed) | text button | 28 px; coarse 44 px | 12 px |

## 4. Shared Card controls

| Control | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Removal consequence block (S26, landed) | section in the Card after the name, not modal | margin 0 12 px 8 px; padding 8 px 10 px; radius 8; 1 px `--shell-refuse` border, `--shell-refuse-bg` | Lines 12 px / 1.4; choice legend 11 px / 600; radio labels 12 px |
| Consequence actions | flex end, gap 6 | 28 px buttons (coarse 44); Remove filled `--shell-refuse`, Cancel neutral | 12 px / 600 |
| Danger menu items (S26, landed) | after an `<hr>` at the end of `•••` | item 28 px | 12 px `--shell-refuse`; disabled `--shell-ink-2` with the reason as hint |
| Submenu (Add to Guide ▸) | opens in place, indented 18 px | items 28 px | 12 px; hint 11 px `--shell-ink-2` |
| Inline rename, Card (landed) | replaces the title | inherits the 19 px serif title; 1 px leaf border, 6 px radius | Error 12 px `--shell-refuse` |
| Inline rename, Index crumb (landed) | replaces the crumb | 12 px crumb metric (`600 12px/1.3 --shell-sans`) | Error 11 px `--shell-refuse` |
| *‹ Back* (S26, landed) | before the kind | 11 px, no extra height (coarse 44) | `--shell-ink-2` |

## 5. Stage and Preview overlays (S28–S30)

These sit on the Stage or in Preview, not in the Card. They keep the shell's dark glass and do not
change the compact Guide or the Round 2 dock.

| Part | Layout | Sizes and spacing | Type role |
| --- | --- | --- | --- |
| Show ▾ popover (S28) | anchored under its Head control | width 248 (Conservatory 264 × 0.92); padding 12; radius 12; `--shell-shadow` | Heading 12 px / 600 with an *editor only* note at 11 px `--shell-ink-3`; segmented 24 px; 8 px between groups |
| Mode pill (S28 Look through, S29 path edit, S30 playback) | centred top of the Stage, flex, gap 8 | padding 4 px 4 px 4 px 12 px; radius 20; `--shell-glass-dark`; buttons 28 px radius 14 | 12 px `--shell-ink-light`, bold `#fff`; accent `--shell-gold`; live dot 8 px gold |
| Preview welcome | centred card | width min(520, 100%); padding 28 px 28 px 24 px; radius 20; dark glass | Overline 11 px caps `--shell-gold`; title 32 px `--shell-serif`; body 13 px `--shell-ink-quiet`; choices in 2 columns (1 below 760 px), gap 12, padding 14, radius 14 |
| Guided controls | bottom grid `1fr auto 1fr`, padding 24 (16 below 760 px) | buttons 44 px, radius 22; primary `--shell-gold` | Caption overline 11 px caps gold; caption title 24 px serif (20 px below 760 px); row 13 px |
| Progress | top, flex, gap 5, max-width 420 | segments 4 px high, radius 2 | — |
| Places | left panel, width 272 (full width below 760 px) | radius 16; head padding 12 px 12 px 10 px 14 px; View grid 2 columns, gap 8, image 16:10, radius 8 | Head 16 px serif; group heads 11 px caps `--shell-gold`; View names 12 px |
| End screen | the welcome card's frame | same as the welcome | Title 28 px serif; actions as the welcome's choices |

Preview overlays use 44 px targets at every pointer, as Conservatory's visitor layer does.
