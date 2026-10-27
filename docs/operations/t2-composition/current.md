# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.**

```text
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E; in progress — S03 recovery ran
       2026-10-27 and remains NOT accepted, open PR #199) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 is shipped with owner-override acceptance 2026-10-23 →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md
        T2.P02.S02 is shipped (PR #185), accepted 2026-10-24 →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/acceptance.md
        T2.P02.S03 is **in-progress / NOT ACCEPTED**. Its failed final gate is preserved at a025e2dd;
        the recovery repair and re-run at 7d1212b6 are recorded without changing the verdict →
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/disposition.md
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s03-integrated-final-gate/recovery.md
BATON: S02 delivers the own-GLB import procedure (review, scale/pivot/footprint/contact, approve),
       placement through the resource-granting planner, and approved-model rendering in the editor and
       Preview. S03's PR carries the gate record, the on-demand acceptance harness, its evidence and
       the recovery record; it is open and is never merged by the slice that wrote it. T1.P02.S02
       (PR #201) is owner-override accepted and **merged** at ce159a1e (merge commit), with anchor
       36c18db9 reachable from main and the tag pushed; its T3 reviews are bf9007ff and 2ad80bbd.
       The T1 merge was the required integration base for the S03 recovery run.
RECOVERY AT 7d1212b6: creator models now offer Resize and Duplicate from the approved resource's
       recorded contact; a Resize proposal no longer cancels itself when its opening control is
       replaced by the scale field. The S03 acceptance journey proves resize/duplicate/delete commit
       (scale 1.5, two instances sharing one assetId, then one remaining entity). An empty project's
       Place instrument now explains that a Room floor must be drawn first, and the new diagnostic
       proves draw Ink enclosure → import/approve/place persists { rooms: 1, resources: 1, entities: 1 }.
       Import hashing moved out of the glTF-Transform pipeline (worker-only ingest), though the route
       total did not fall below budget.
VERIFICATION AT 7d1212b6: check 0/0; tsc --noEmit clean; build succeeded; test:arch 22/180;
       test:full 214/2,655; test:api 114/114 with 0 skipped on a dedicated DB; check:api,
       check:project-model, check:layout-core and check:camera-core clean; S03 acceptance 2/2
       (38.3 s) and diagnostics 4/4 (46.3 s) in branded Chrome on the designated M2.
OWNER RUN: still owed at this revision. F3/F4/F8 at S/M, per-move evaluation, F2 open, F13 leak
       cycles, F6 as defined, shell observations (offline retry, narrow desktop, reduced motion on,
       lens park/Resume, keyboard-only transforms, accessible name/focus return), Draco/KTX2, the real
       >50 MiB decode, real R2, worker-boundary timing and GPU memory were not run under the formal
       method. The recovery runs were agent-operated, so they are not pass-scoped acceptance evidence.
FOLLOW-UPS: in-flight fetch dedupe across overlapping model resolutions; a model-failure notice can
       overwrite an unrelated route notice. The placed-model selection, Resize/Duplicate and
       empty-project guidance gaps from the failed gate are repaired at 7d1212b6 and need independent
       re-review; the silent floor refusal is now an explicit instruction.
NEXT:  the owner must dispose (1) the Stage first-load **456.7 KiB br** against the ≤400 KiB hard
       budget, with attribution in the recovery record (three core 155.9 KiB, layout-core 70.3 KiB,
       project-model 48.5 KiB, editor adapters 29.9 KiB, editor stage 21.9 KiB, svelte 20.3 KiB,
       three addons 18.5 KiB) — the persistent single Canvas serves both Plan and 3D, so lazy-loading
       three would remove the Plan reading rather than spare capability; (2) the formal performance
       rows and method (owner operator, ten runs, declared power state, pass-scoped bench manifest);
       (3) whether “from an empty project” is satisfied by drawing the enclosure first, now proven
       and guided, or the line must be amended; (4) F6's ten-run sequenced-drag extension.
BLOCKER: S03 is NOT accepted and T2.P02 is active/not closable. The manipulation and empty-project
       product gaps are repaired, but the Stage delivery budget hard-misses and the formal owner-run
       rows are unrun at 7d1212b6. Do not accept, merge #199, close the phase or create successor work.
ROUTE: ./README.md → ../../roadmap/t2-composition/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
CARRY: T3.P04.S01 shipped project-deletion and model-revision cleanup (PR #191, aa1db37a); S03
       verifies retention/pin integrity without adding deletion or re-accepting C3. Further planning
       pairs T1 face frames with solve-once placement; component provider work precedes Stage
       part-selection/admission UI and annotations. No follow-on authorization is implied.
```
