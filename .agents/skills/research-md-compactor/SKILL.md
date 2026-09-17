---
name: research-md-compactor
description: Convert long verbose research Markdown into compact reference-grade knowledge artifacts preserving substantive content at field level. Use when user asks to compact, compress, normalize, densify, deduplicate, or make deep-research LLM-context friendly.
---

# Research MD Compactor

Compression + normalization + reorganization. **NOT summarization.**

Goal: compact artifact can replace verbose source as canonical reference after loss audit passes. Do not claim mathematical/literal losslessness; target **field-level reconstructability**.

## When to use

- User asks to: compact research Markdown; compress deep research without losing info; normalize research doc; make research LLM-context friendly; turn verbose research into canonical reference notes; deduplicate without summarizing; reorganize into compact knowledge-base artifact; create archival/reference version.
- Source is: deep-research output; architecture/implementation/codebase research; competitive/market/strategic analysis; design-precedent or asset/library research; multi-source cited report; long conversational research assembled across answers.

## When NOT to use

- User explicitly wants ordinary summary, executive-summary-only, key takeaways only, intentional info removal, or short briefing.
- User asks for new research, version updates, re-research, or reinterpretation. Out of scope.

## Governing invariant

A substantive item counts as preserved only if a future agent using the compact artifact alone can recover the same decision, relationship, test assertion, implementation constraint, evidence claim, caveat, or research implication without the original prose. Preserving the "general idea" is insufficient.

## Preservation classes

Protected unless clearly redundant. If unsure, preserve:

findings; conclusions; recommendations; architecture decisions; product implications; tradeoffs; assumptions; constraints; algorithms; APIs; types/schemas; field names; operation semantics; validation rules; execution ordering; migration constraints; benchmarks; numbers, percentages, dates, versions, scores, rankings, priorities, statuses, licenses; project/repo names; filenames; paths; module names; commands; CLI flags; env vars; URLs; citations; examples; worked examples; test fixtures; input/output scenarios; edge cases; reject/defer decisions; uncertainty; confidence levels; disagreements; source-vs-analysis distinctions; unresolved questions.

## Workflow — three passes

### Pass 1 — Source inventory (before rewriting)

Inventory, do not rely on memory while rewriting:

- original sections; findings; conclusions; recommendations;
- named entities: projects/products/tools/models/companies/repos;
- citations + URLs with owning claim;
- numeric facts: benchmarks, versions, dates, counts, thresholds, scores;
- every table/matrix + column schema + every row;
- every substantive enumeration + members;
- protected tokens (identifiers, fields, flags, paths, IDs, endpoints, keys, statuses, formats, roadmap IDs e.g. `P23`);
- schemas/types/APIs; code/CLI examples;
- test fixtures/worked examples (inputs, ops, outputs, invariants, edges);
- reject/defer decisions; caveats; confidence/hypothesis status; unresolved questions.

### Pass 2 — Compact + reorganize by concept

- Reorganize by concept, not conversational chronology. Adapt, but prefer: Thesis/direction; Executive findings; Key concepts/definitions; Current state/SOTA; Relevant projects/implementations; Technical approaches; Architecture/data/operation contracts; Comparisons/tradeoffs; Evidence/benchmarks; Concrete tests/fixtures; Product/roadmap implications; Risks/limitations/unresolved; Recommendations; Source/reference index; Research inventory + loss audit.
- For strategic research use the document's natural conceptual structure; do not force technical headings.
- Prefer: dense bullets; semicolon-separated facts; compact tables/matrices; short factual blocks; fragments where clear; grouped common fields; canonical terminology.
- Avoid: blog/essay prose; transitions; conversational phrasing; repeated framing; rhetorical setup/questions; motivational language; restated questions; duplicated conclusions.
- Compress wording and redundancy, never depth.

### Pass 3 — Adversarial loss audit

Compare compact output against inventory AND source, section-by-section. Randomly sample unrelated sections; ask whether each item is reconstructable. Run the checklist below. Gate, not boilerplate.

## Deduplication

Repeats may merge only after checking for unique: qualifier; example; number; source; caveat; implementation detail; implication; confidence; exception; edge case; recommendation. Merge all unique info into canonical statement. Do not merge claims that differ in provenance, scope, confidence, or implication.

## Structured-data preservation

Tables, matrices, grids, rankings, scorecards are protected. Every meaningful cell relationship is substantive.

- May: reformat; merge overlapping tables (merge columns, never drop dimensions); convert to compact structured rows/bullets; transpose.
- Must keep reconstructable: per-row reference/source, reusable candidate, complexity, risk, license, score, priority, status, bucket, rationale, verdict.
- Valid: `Intersection snap — ref LibreCAD; reuse own/Flatten; complexity Med; arch-risk Low; bucket P23-min.`
- Invalid: `Intersection snap — P23 feature.` (drops reference/reuse/complexity/risk).

## Row-level reconstruction invariant

Every original structured row must remain independently reconstructable. Group rows only when lifted/shared fields are actually identical. If rows differ in even one substantive field, preserve the difference. Do NOT collapse e.g. Display/plinth + Frames + Lighting tracks into one "Scene generators" row if media-plane child, light instances, mounting context, destinations, or implementation differ. Audit **row x column values**, not mere column presence.

## Enumeration closure invariant (mandatory)

- Before rewriting, inventory every substantive enumeration: counts (`polygon/vertex/material/object/animation`); names (`node/material/animation + extras`); entity kinds; validation checks; metadata fields; pipeline stages; formats; rejected approaches; capability lists; roadmap phases; test steps.
- After rewriting, audit member-by-member. Syntax may shorten; exact wording may change; every semantically distinct member must remain recoverable.
- Umbrella term NEVER preserves members. Invalid: `counts`; `names/extras`; `editor features`; `Region/Surface/Anchor/Portal/Subject/Destination → spatial semantics`. Valid: `polygon/vertex/material/object/animation counts` (or `poly/vert/mat/obj/anim counts`).

## Protected-token invariant

High-risk tokens: identifiers; field/type members; enum values; CLI flags (e.g. `-kn/-km/-ke`); filenames; module names; paths; IDs; API endpoints; URL routes; metadata keys (e.g. `icon, planIcon, shelfElevations, shelfBoxes, dropOnTopElevation`); status/format/extension names; versions; roadmap IDs (`P23, P24`); domain/entity names. Group compactly but never collapse distinctions: `-kn = keep named nodes/meshes; -km = keep named materials; -ke = keep extras` must NOT become `keep names/extras`.

## Fixture / worked-example preservation

Tests, fixtures, acceptance scenarios, worked transformations are protected. Never replace with general rule.

Preserve where present: exact (or semantically equivalent, no added inference) inputs; operation/action; expected outputs; invariants; edge condition; failure behavior; transaction/history behavior; purpose. Future agent must re-assert the test.

- Invalid: `Wall resize preserves fixed endpoint.`
- Valid: `Precision fixture: wall 3m; setWallLength(4m,fixed=start) → start unchanged; end deterministic; one history entry.`

## Descriptive-cell preservation

Descriptive wording may encode use, appearance, category, semantics, environment, behavior, intent, source distinction. Normalize phrasing but keep meaningful qualifiers: `Gallery/event hall neutral` NOT → `Gallery`; `Rough/damaged plaster` NOT → `rough`; keep `wall-mounted`, `media plane child`, etc.

## Technical fidelity

Never simplify to shorten. Preserve: ownership boundaries; canonical-vs-derived state; transaction semantics; layering; data flow; execution order; coordinate conventions; algorithms; tolerance distinctions; validation boundaries; operation contracts; threading/worker assumptions; persistence and source-of-truth rules; migration/defer thresholds; performance constraints; API contracts. Dense syntax over omitted depth.

## Evidence and provenance

- Keep citations/URLs/named sources attached to claims. Keep multiple sources when they support different aspects. Never invent citations. Never silently promote inference → sourced fact.
- Preserve status distinctions the source makes: source claim vs reported result vs author analysis vs inference vs recommendation vs hypothesis vs uncertain/low-confidence conclusion; production vs experimental vs research vs vendor demo vs community demo vs anecdotal. Preserve evidence weighting.

## Citation portability

Preserve every citation marker exactly. Keep real URLs verbatim (incl. query strings). If source has only opaque/platform-local handles (e.g. `turn20search11`, `turn11academia38`) with no portable URL, do NOT invent URLs; add to audit: `Citation portability: NON-PORTABLE source handles remain; original platform context may be required to resolve them.` Not a compression failure if original lacked URLs.

## No unauthorized research

Work only from supplied document. Do not introduce facts from memory; update versions; re-research claims; silently resolve contradictions; "correct" conclusions. Neutral organizational labels/headings allowed. Preserve contradictions and uncertainty as-is.

## Mandatory loss audit

Verify against inventory + source:

- [ ] every original section accounted for
- [ ] every table/matrix preserved at field level; every row independently reconstructable; every column/cell relationship retained
- [ ] every substantive enumeration member-by-member closed (no umbrella substitution)
- [ ] every protected token retained or explicitly mapped
- [ ] every named project/product/tool/model/company retained
- [ ] every source/citation/URL retained and attached to its claim
- [ ] every quantitative fact + benchmark retained
- [ ] every concrete fixture retained with inputs/outputs/invariants/edges
- [ ] every reject/defer decision retained
- [ ] every uncertainty/caveat/confidence distinction retained
- [ ] every inference-vs-fact distinction retained; every unresolved question retained
- [ ] no new facts, unsupported conclusions, or strengthened recommendations (`candidate/consider/hypothesis` must NOT become `must`)
- [ ] citation portability flagged if applicable

Unintegrable remainder goes under `Additional Findings / Raw Notes`. Never delete to hit size.

## Research inventory (required tail section)

Compact list, not duplicate prose:

- Named projects/products/tools/models/companies.
- Sources/references (URLs/citations or where attached).
- Quantitative facts/benchmarks (numbers, versions, scores, dates).
- Unresolved/hypothesis-status items (open questions, tentative/low-confidence, inference-only).
- Structure mapping: original-matrix → compact section; fixture-family → compact section (e.g. `capability matrix → §7; risks matrix → §12`).

## Audit truthfulness

Never claim literal losslessness. Forbidden: `100% lossless`, `nothing was lost`, `all wording preserved`, `verbatim` (unless literally true). Preferred after real checks: `Field-level audit passes.` / `All substantive source items accounted for.` / `Exact inputs/outputs/invariants preserved in compressed syntax.` / `Row x column audit passes.` / `Enumeration-closure audit passes.` / `Protected-token audit passes.` State remaining uncertainty explicitly.

## Compression ratio

No fixed target. Ratio follows verbosity: 4000-line conversational transcript may shrink 80–95%; dense 900-line evidence-heavy report may shrink only 40–60%. Information density > percentage. Never delete substance for size.

## Output contract

When invoked on a research document, output only the reorganized compact artifact unless user explicitly asks for commentary. No preamble, change log, process narration, apologies, summary-of-summary. Final artifact reads as dense research notes / technical reference / knowledge-base entry / canonical context document — not blog, essay, casual answer, or executive-summary-only. If asked to update a file, edit in place and confirm locations briefly.

## Anti-patterns

1. Summary substitution — keeping only decisions/takeaways.
2. Matrix collapse — rows/columns → generic category list.
3. Fixture abstraction — exact test → general rule.
4. Row merging — grouping rows with differing cells.
5. Enumeration collapse — `A/B/C/D → categories`.
6. Protected-token collapse — `-kn/-km/-ke → keep names`.
7. Descriptive-cell erosion — dropping `event hall`, `damaged`, `wall-mounted`.
8. Provenance loss — detaching citations from claims.
9. Evidence-strength flattening — vendor demo = research benchmark = production.
10. Caveat deletion — keeping conclusion, dropping uncertainty.
11. Recommendation strengthening — `consider` → `must`.
12. False audit pass — asserting preservation from section presence without field-level comparison.

## Examples

Source row: `| Intersection snap | LibreCAD | own/Flatten | Medium | Low | P23 Minimum |`
- Valid: `Intersection snap — ref LibreCAD; reuse own/Flatten; complexity Med; arch-risk Low; bucket P23-min.`
- Invalid: `Intersection snap — P23 feature.`

Source fixture: `wall 6m, opening@4m, split@3m → second-wall offset 1m, source ref gone, one transaction.`
- Valid: `Split: wall 6m, opening center 4m, split@3m → 2nd-wall offset=1m (4−3); source ref gone; new ref valid; one transaction; crossing→reject/explicit; no orphan.`
- Invalid: `Splits transfer openings deterministically.`

Source tokens: `-kn = keep named nodes/meshes; -km = keep named materials; -ke = keep extras`
- Valid: `-kn/-km/-ke preserved as three distinct flags with above semantics.`
- Invalid: `keep names/extras.`
