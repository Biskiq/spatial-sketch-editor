# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.**

```text
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E; in progress, S03 released) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 is shipped with owner-override acceptance 2026-10-23 →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md
        T2.P02.S02 is shipped (PR #185), accepted 2026-10-24 for implementation
        tree `082e384c` →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/acceptance.md
        T2.P02.S03 integrated final gate **ran 2026-10-27 and is NOT accepted** — two required rows
        blocked, the empty-project line unreachable, one hard delivery row misses →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/acceptance.md
BATON: S02 delivers the own-GLB import procedure (review, scale/pivot/footprint/contact, approve),
       placement through the resource-granting planner, and approved-model rendering in the editor and
       Preview. Durable current behavior is in the owning assets, Scene content and persistence references.
       S03's PR carries the gate record, the on-demand acceptance harness and its evidence; it is open
       for independent review and is never merged by the slice that wrote it. No slice is in progress
       on this track.
OWNER DECISIONS (2026-10-23/24): T1 host patch accepted 2026-10-24; editable Card facts stay read-only
       (option b); the placed-creator-model selection gap is kept unfixed as a T1/T2 follow-up.
OWNER-RUN: S03 dispositioned S02's rows in its record — Preview pixels, F5, F13 and F9 measured on the
       designated M2 (owner attribution outstanding); F6 undecided at 34.4 ms p95 (S cold) against
       33 ms; GPU memory blocked by the browser API. Shell observations (offline retry, narrow desktop,
       reduced motion on, lens park/Resume, keyboard-only transforms, accessible name/focus return),
       Draco/KTX2, the real >50 MiB decode, real R2 and worker-boundary timing remain **unrun**. Never
       presented as passed.
FOLLOW-UPS: in-flight fetch dedupe across overlapping model resolutions; a model-failure notice can
       overwrite an unrelated route notice; the pointer-placement selection gap (T1/T2) — narrowed by
       S03's probe to the pointer completion, since a typed placement selects its entity and Compose
       acts on it; the empty project's silent placement refusal.
NEXT:  owner decisions from the gate record: (1) authorize the pointer-placement selection fix — or a
       reachable selection path — so Resize/Duplicate/Delete are reachable, then re-run those lines;
       (2) dispose of the Stage first-load 447.0 KiB br miss against the ≤400 KiB hard budget;
       (3) authorize F6's ten-run extension with the sequenced drag; (4) complete the remaining
       owner-run rows; (5) decide what "from an empty project" means for this gate and whether the
       Place instrument should say why a floor click installs nothing. S03 measured on S06's method and carried S02's rows as the record states.
       S01/S02 remain accepted and untouched; phase close stays owner-invoked and unclaimed.
BLOCKER: S03 is blocked on (1), the empty-project line and the Stage first-load hard miss. A pointer
       placement does not leave its new entity canonically selected — the room stays selected, so
       Compose's Resize/Duplicate/Delete are disabled for the only path an imported model has — which
       is the gap the owner recorded 2026-10-24 and kept unfixed. An empty project has no Room floor,
       so a model cannot be placed there at all. Do not absorb either into a verification slice; do not
       claim acceptance or a closable phase.
ROUTE: ./README.md → ../../roadmap/t2-composition/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
CARRY: T3.P04.S01 shipped project-deletion and model-revision cleanup (PR #191, `aa1db37a`);
       S03 verifies retention/pin integrity without adding deletion or re-accepting C3. Further planning pairs T1 face
       frames with solve-once placement; component provider work precedes Stage part-selection/admission
       UI and annotations. No follow-on authorization is implied.
```
