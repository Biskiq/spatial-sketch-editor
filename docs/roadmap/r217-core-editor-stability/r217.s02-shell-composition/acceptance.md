# R217.S02 — acceptance record: Shell composition

**Slice:** R217.S02 · **Status:** approved (plan); no acceptance recorded · **Plan:**
[implementation-plan.md](./implementation-plan.md) (owns the criteria) · **Phase:**
[R217](../README.md) · **Integration route:** [R217.S11](../r217.s11-integrated-final-gate/acceptance.md)

Owner released S02 for implementation on 2026-10-28. Trusted base: `8c2c86e638e65a4a0500fa1e3e15b647932549f7` (PR #220). Implementation, reviews and acceptance remain outstanding.

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
