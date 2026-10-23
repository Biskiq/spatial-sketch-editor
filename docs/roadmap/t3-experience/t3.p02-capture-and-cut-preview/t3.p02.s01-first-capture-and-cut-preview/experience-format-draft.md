# T3.P02.S01 — Experience format draft — CLOSED STUB

```text
AUTHORITY: NONE — closed design evidence. T3.P02.S01 acceptance → ./acceptance.md;
           approved scope and S02 integration route → ./implementation-plan.md.
DELIVERED: The proposal became Experience unit format 2: Presentations own ordered Views,
           Default, subject and bounded plain text; Stops may select an entry View; continuation
           selects Cut or supported Travel. The implemented bound is 4,000 Unicode code points;
           text remains Presentation-owned and `entryViewId` alone expresses a Stop's entry role.
CONTRACT:  The draft itself was not ratified as a standalone durable contract. Current behavior is
           implemented in the F.2 unit and program codecs; the owner accepted S01 by override at
           integrated revision `1bb281bb16dc839588e4174514b240de6c52bf79`.
PROVENANCE: Original PR178 source `26531059ff1bc51bbb352ae7f351071858b501fa`; original owner
           ruling commit `56dc86f6d6d1d14b51a6c0096802f4465113345b`.
RECOVERY:  git show closed/T3.P02.S01:docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/experience-format-draft.md
ANCHOR:    `closed/T3.P02.S01` → `11bd77b958978e82436a62ca65601f06cb301481`
```

```text
ENTRY POINTS
unit codec      packages/project-model/src/units/types.ts · packages/project-model/src/units/validate.ts
program codec   packages/project-model/src/program/types.ts · packages/project-model/src/program/validate.ts
runtime         packages/project-model/src/units/experience/lowering.ts · interpreter.ts
regressions     apps/editor/tests/lib/experience/experience-runtime.test.ts ·
                apps/editor/tests/lib/project-model/units-conformance.test.ts
```
