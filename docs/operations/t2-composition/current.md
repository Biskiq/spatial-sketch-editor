# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.**

```text
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E; in progress — S03 ran
       2026-10-27 and is NOT accepted, open PR #199) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 is shipped with owner-override acceptance 2026-10-23 →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md
        T2.P02.S02 is shipped (PR #185), accepted 2026-10-24 for implementation
        tree `082e384c` →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/acceptance.md
        T2.P02.S03 is **in-progress**; its integrated final gate **ran 2026-10-27 and is NOT
        accepted** — two required rows blocked, the empty-project line unreachable on that base,
        one hard delivery row misses. The failed-gate disposition preserves the verdict and routes
        the owner decisions →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/disposition.md
BATON: S02 delivers the own-GLB import procedure (review, scale/pivot/footprint/contact, approve),
       placement through the resource-granting planner, and approved-model rendering in the editor and
       Preview. Durable current behavior is in the owning assets, Scene content and persistence references.
       S03's PR carries the gate record, the on-demand acceptance harness, its evidence and the
       failed-gate disposition; it is open and is never merged by the slice that wrote it. T1's #201 is
       T3-accepted at `bf9007ff` (docs-only `8ea82633`) but **not merged**; on a scratch integration its
       press-claim removes the pointer-selection overwrite, while Resize/Duplicate still refuse a
       creator model for verified contact. Any S03 re-run must use the resulting `main` and re-record
       the affected rows. No other slice is in progress on this track.
OWNER DECISIONS (2026-10-23/24): T1 host patch accepted 2026-10-24; editable Card facts stay read-only
       (option b); the placed-creator-model selection gap was kept unfixed as a T1/T2 follow-up and is
       removed by #201's press-claim on the integrated tree (not merged or re-accepted); Resize/Duplicate
       still refuse for verified contact. The five S03 decisions remain open (NEXT).
OWNER-RUN: S03 dispositioned S02's rows in its record. F5/F6/F9/F13 were **measured, not discharged**
       on the designated M2: the pass used the S06-scoped milestone profile, produced no pass-scoped
       bench manifest, recorded no power state and was agent-operated, so no row is acceptance
       evidence; F9's DOM-update timings cannot establish presented feedback and F13 measured Undo,
       not Compose Delete. F6's proxy sits at 34.4 ms p95 (S cold) against 33 ms; GPU memory blocked by
       the browser API. Shell observations (offline retry, narrow desktop, reduced motion on, lens
       park/Resume, keyboard-only transforms, accessible name/focus return), Draco/KTX2, the real
       >50 MiB decode, real R2 and worker-boundary timing remain **unrun**. Never presented as passed.
FOLLOW-UPS: in-flight fetch dedupe across overlapping model resolutions; a model-failure notice can
       overwrite an unrelated route notice; Resize/Duplicate refuse a placed creator model for lack of
       verified contact (Delete is enabled) on the integrated tree; the empty project's silent
       placement refusal. The pointer-placement selection overwrite is removed by #201's press-claim
       on the integrated tree, not yet merged or re-accepted.
NEXT:  the five owner decisions in the S03 disposition are open: (1) decide whether a post-#201 re-run
       can accept the manipulation row (selection is fixed; Resize/Duplicate still refuse for verified
       contact) or amend the phase outcome; (2) dispose of the Stage 456.0 KiB br first-load miss
       against the ≤400 KiB hard budget (447.0 on the #199 base; #201 adds +9.0); (3) authorize F6's
       ten-run extension with the sequenced drag; (4) complete the owner-run rows and decide how the
       hard rows are discharged formally (10 runs, declared power, owner operator, pass-scoped
       manifest); (5) decide what "from an empty project" means (drawing first is now possible with
       Ink) and whether Place must explain a refused floor click. S03 reused the S06 milestone
       harness, which the contract scopes to S06 only, so its rows are measurements and not
       acceptance evidence; S02's rows were carried as the record states. S01/S02 remain accepted and
       untouched; phase close stays owner-invoked and unclaimed.
BLOCKER: S03 is NOT accepted and T2.P02 is active/not closable. The required manipulation row is
       still not passable on the integrated tree: #201 fixes selection, but Resize/Duplicate remain
       disabled for a placed creator model ("verified contact"); the empty-project line needs a drawn
       enclosure first and the Place instrument is silent without a floor; the Stage first-load hard
       budget misses at 456.0 KiB br. The formal performance rows remain unrun or not pass-scoped. Do
       not accept, close the phase or create successor work; do not absorb the product gaps into a
       verification slice.
ROUTE: ./README.md → ../../roadmap/t2-composition/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
CARRY: T3.P04.S01 shipped project-deletion and model-revision cleanup (PR #191, `aa1db37a`);
       S03 verifies retention/pin integrity without adding deletion or re-accepting C3. Further planning pairs T1 face
       frames with solve-once placement; component provider work precedes Stage part-selection/admission
       UI and annotations. No follow-on authorization is implied.
```
