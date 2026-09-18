# P23.14 PLATE — owner review notes

## Contradictions / unresolved direction

- **3D / Arrange:** §§2.4 and 15.2 restrict Layout/Arrange to Scene Plan, while §25.1 names canonical B “Scene / 3D / Arrange.” The atlas preserves that specimen title but exposes the mode control only in Scene Plan. Owner must clarify the title before implementation.
- **Drawer left edge:** §17 says central-work-column span; PNGs start after the Tool Tray. Atlas follows the written column boundary, including the tray width.
- No ratified compact-reference scheme is supplied for Buildings, Floors, Scene objects, cameras or sequences. Atlas preserves R/W/O/J identity and uses names plus camera sequence ordinals elsewhere; it does not adopt generated M-/F-/OBJ-/CAM-/SEQ- tokens as contracts.

## Deliberate PNG corrections

- Domain stations use restrained 3 px inboard edge-lights, not full brass/cyan fills. PLATE Light is the only baseline.
- Reference geometry is 1440 × 900; spine 56, head 36, Navigator 268, Inspector 300, View Bar 34, Tool Tray 44, Status 24, Drawer 48/288 px. Spatial and Publish remain separate actions.
- Protected Wall / Rect Room / Poly Room / Door / Window icons use the installed Lucide nodes from the existing toolbar. Select / Column / Platform / Plinth / Snap / Grid paths are copied verbatim from PlanDraftIcon. Embedded licenses retained.
- The named shared wall bounds Gallery North and Main Hall, so its selected Plan occurrence lies on their common boundary, not the PNG’s exterior north wall.
- Camera Graph is explicitly contextual; ordinal numbers mean sequence position, not canonical IDs. Plan has no finite frustum. Expanded Timeline has only the five ratified lanes, one playhead, and a quiet 0° Roll readout.
- Names may ellipsize; compact references remain complete. Rename occurs only in Inspector; raw fixture IDs remain under Technical details. Secondary ink is darkened for contrast.

## Remaining QA risks

- Spatial illustrations are editable SVG fixtures, not product-renderer captures. The 3D illustration is intentionally less photoreal than the PNGs; renderer lighting, material fidelity, camera projection and exact P23.13 geometry require implementation comparison. Inventory stress entries beyond the drawn ground-floor sample have identity/readout coverage, not individual spatial geometry.
- P24 property values, multi-selection outlines and P26 elevation are pressure fixtures, not new behavior contracts. Numeric properties are readouts; global project actions are composition specimens. Destructive controls preserve the QA fixture.
- Only PLATE Light is represented. Alternate-theme contrast remains unvalidated if variants are retained. Platform font fallback may change text metrics; the contract does not name font families.
- Browser checks cover canonical switching, 48/288 px Drawer geometry, five lanes, 72 canonical walls / 73 occurrences, search/reveal, shared selection, rename propagation and P26 return. Automated accessibility checks require manual SVG/contrast review; screen-reader reading order and real coarse-pointer usability still need device acceptance. Compact desktop frames retain scrollable panels and a 1:1 inspection canvas; this is not a mobile product layout.
