# R217.S02 — acceptance record: Shell composition

**Slice:** R217.S02 · **Status:** accepted, reviewed 2026-10-29 · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

Owner released S02 for implementation on 2026-10-28 and directed acceptance and routine closeout
after verification and cross-track review on 2026-10-29. Trusted base:
`8c2c86e638e65a4a0500fa1e3e15b647932549f7` (PR #220); reviewed implementation and test revision:
`535af8d5`. Independent T3, T2 and T5 agent reviews are clean for their respective Camera/Experience,
Scene and native-form concerns after corrections. They are technical reviews, not GitHub approvals.

**Owner ruling, 2026-10-29:** Preserve the existing Camera contract on viewport resize: target,
orientation and vertical world extent remain fixed, while meters per CSS pixel follows the extent
divided by viewport height. This resolves the former acceptance wording, which demanded constant
pixel scale even as height changed. Shell changes issue no implicit framing intents; no Camera
implementation change is authorized. T3 review of Camera compatibility remains required.

## PLATE conformance audit at the trusted base

The dispositions below cover the shared shell and responsive rules; gaps are planned work, not
claims of acceptance. Test references name the planned regression evidence in plan §5.

| Rule | Disposition and evidence |
| --- | --- |
| Shared Head, Index, Stage, contextual Card and lower working edge; Stage dominance | Gap → §4.2–4.5; shell composition and responsive browser tests (§5.2, §5.5–6). |
| Head application menu, settings, keys, compact single row and collapsed location | Gap → §4.2; Head tests (§5.4) and responsive browser test (§5.6). Source history is outside R217 (T3). |
| World/Experience lens identity and shared application actions | Conforms in existing Head; preserve and review Experience journeys (§5.7, T3). |
| Index as locator, operations, search and membership reasons | Locator operations conform; tool/task rows gap → §4.3; entry-set and locator tests (§5.3). Full scope-model Index is outside R217 (T1/T3). |
| Collapsed Index takes no width; location and selection remain recoverable | Gap → §4.2–4.3; zero-width and location-chip tests (§5.3–4). |
| Card represents canonical selection, absent without context; domain owns ordinary writer | Conforms in `EditorCard`; preserve canonical identity and writers (§5.7, T2/T5 review). |
| Card overlays Stage, retains identity when compressed and arbitrates with active lower work | Gap → §4.4–4.5; bounding-box arbitration test (§5.5). Ask Rule and domain edit reach are outside this slice (domain owners). |
| Dock, palette and Instrument stack bottom-up, with forest material and contextual invocation | Gap → §4.4; shell composition and arbitration tests (§5.5). Dock contents, icons, arming and palette behavior belong to S10; task semantics remain with their owners. |
| Local versus breadth task span, Guide composition and contextual depth | Preserve existing task semantics and Stage dominance; responsive and Experience tests (§5.5–7). Guide redesign and new breadth claims are outside R217 (T3). |
| Named identity, disambiguation, technical IDs and owner/source/reach disclosures | Preserve existing identity and domain disclosures; full scope model and semantic redesign are outside R217 (T1/T2/T3/T5). |
| Narrow Index overlay and Card sheet, both invoked; Index scrim leaves dock usable | Gap → §4.5; browser checks at 1024 × 768 and 768 × 1024 (§5.5–6). |
| Opening a procedure closes Card sheet; lower task and reserved furniture stay accessible | Gap → §4.4–4.5; arbitration and browser checks (§5.5–6). Reading/drafting and Height Sheet functionality belong to S05/S06. |
| Resizing and sheet changes preserve Camera standpoint and scale | Gap → §4.6; viewport invariance test (§5.2); Camera reframe is a stop condition. |
| Touch targets and hover reveals have touch paths | Gap → §4.7; coarse-pointer browser checks (§5.6). Spatial marks and Height Sheet touch behavior belong to S07/S06. |
| Phone editor layout | Outside R217 (owner); small laptop and iPad are the supported targets. |

### Contribution inventory before relocation

All entries below are already exposed by Head Find; relocation removes Index duplication and keeps
the existing task entry and domain owner. Owner review is still required.

| Existing entry | Owner | S02 home |
| --- | --- | --- |
| Ink · Wall | Layout / T1 | Dock and Find (Arm) |
| Place plinth | Layout / T1 | Find (Invoke) |
| Place object, Arrange, Resize, Duplicate, Delete, Import model | Scene / T2 | Find (Invoke); S10 supplies Library for Place object |
| Experience authoring | Experience / T3 | Find (Invoke); existing Experience lens remains owner |
| Shape | Scene forms / T5 | Ink reading; review the existing contribution and any moved form entries |

## Acceptance evidence

| Criterion | Evidence at the reviewed revision |
| --- | --- |
| Audit | First commit `708cbfe6` records the PLATE audit and pre-move inventory above; gap rows route to plan §4 and its tests. |
| Camera and shell | `stage-shell-composition.test.ts` checks the owner's 768 → 1024 px vertical-extent rule; `spatial-route-gesture.test.ts` exercises Index, Card, Instrument and viewport changes and asserts no viewing intent. T3 reviewed Camera compatibility. |
| Index and entries | The mounted route compares every adapter-qualified registered entry with Head Find and verifies no contributed Index rows. Scene coverage invokes all six Scene entries through their owning adapter. Collapsed Index is `hidden` with zero layout width; the location chip reopens it. |
| Head and preferences | `head-find.test.ts` covers the shortcut and location chip. `spatial-route-resume-save.test.ts` checks reduced motion after remount and compares fresh Save capture source bytes before and after the preference. Storage failure and clock continuity have focused tests. |
| Arbitration | At 1024 × 768 with a selected Wall and Place plinth Instrument, browser boxes were Card (624,394–960,465), Instrument (294,476–730,696), dock (426,703–598,756), reading slot (12,66–204,114) and height slot (968,118–1012,688); they did not overlap. At 768 × 1024 Card and Instrument were vertically disjoint as well. Breakpoint: overlay/sheet at ≤1279 px; docked Index at ≥1280 px. |
| Coarse pointer | On a task-owned agent-browser session, Chrome touch emulation reported `pointer: coarse` and `hover: none` at 1024 × 768 and 768 × 1024. Visible shell controls, including open Find, app menu, Index, Card and Instrument, were checked for 44 × 44 px minimum; none were undersized. Index row actions and dock names are visible without hover. |
| Experience | Browser journey created an Experience, captured a Presentation, entered and exited Preview; the Experience surface and invoked Instrument were disjoint. T3 reviewed the shell and Camera seam. Editor motion speed affects inspection timing; isolated Preview timing is unchanged. |
| Isolation | `f4-public-isolation.test.ts` walks both public and visitor Preview closures and excludes the browser-local preference module. The architecture lane and production build passed. |

**Verification:** `npm test` 234 files / 2,952 tests, `npm run test:arch` 23 files / 193 tests,
`npm run check` 0 errors / 0 warnings, `npm run build`, the Layout, project-model, Camera and API
type checks, and DB-backed `npm run test:api` 122 passed / 0 skipped. The API used a dedicated local
database, removed after the run. The build, API and package checks covered the same production tree
at `0ff839a7`; subsequent commits through `535af8d5` add tests only. The full editor suite, arch
lane and editor check ran at `535af8d5` with a clean working tree. `git diff --check` passed from
trusted base to that revision. An earlier full run failed one unrelated Layout timeout under
competing verification load; the isolated rerun passed. No performance benchmark was run.

**Integration obligations:** R217.S04 consumes Paper/Shaded; S05/S06 fill the reserved furniture
slots; S10 owns dock completion and Library. R217.S11 owns the exhaustive integrated final gate.
S03's separately claimed pointer/key handlers remain its own integration and merge obligation.
