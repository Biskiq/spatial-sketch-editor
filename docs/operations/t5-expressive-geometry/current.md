# T5 — Expressive Geometry: current baton

Track-scoped handoff. **Replace only this file for T5 work.**

```text
PHASE: T5.P01 Drawn native objects — active; S01 shipped, S02 implemented and awaiting acceptance,
       S03–S04 proposed → ../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md
DIRECTION: ../../roadmap/t5-expressive-geometry/umbrella-plan.md
       (E0 withdrawn 2026-10-27; ../../reference/decisions/t5-object-focus-planning-2026-10-27.md)
SLICES: S01 (native form source and evaluation) shipped and accepted by **owner-override** 2026-10-28
       at product head 7c3445e1, PR #208 → [acceptance stub](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s01-native-form-source-and-evaluation/acceptance.md)
       S02 (Shape reading and sizing) is implemented on t5/p01-s02-shape-reading at 6a925f5d;
       a real-browser UX review (18 passed scenarios, one deliberate availability refusal) is
       recorded in its [acceptance record](../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/t5.p01.s02-shape-reading-and-sizing/acceptance.md),
       and acceptance is **not** claimed. S03 (integrated final gate) and S04 (My Objects) remain proposed.
POLICY: T5 dependencies follow the T5 licensing amendment
       (../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-t5-dependency-licensing).
NEXT:  S02 waits on T1 review of the Ink reading seam and the Stage host fix, T2 review of the Scene
       adapter, and owner acceptance of its record; its browser review is complete. S03 owns the
       exhaustive final gate and the suspended battery rows. No further implementation is authorized
       by this baton. S04 still waits on owner release and T2 agreement on the library-scope design
       (D8); registering T5.P02 is also an owner planning act. Do not start a slice from this baton.
BLOCKERS: None for S01. S03, the phase's declared final gate and S01's integration route, carries the
       deferred battery-mode performance rows; AC measurements stay diagnostic. The Stage 439.0 KiB br
       exception remains, and no correctness criterion, including 6, was waived. Deferred rows and the
       accepted artifact gaps are in the S01 acceptance stub. Omitted scopes stay held.
ROUTE: ./README.md → ../../roadmap/t5-expressive-geometry/README.md →
       ../../roadmap/t5-expressive-geometry/t5.p01-drawn-native-objects/README.md
RELEASE: ../../roadmap/now.md remains the only permission list; the shipped S01 row stays until an
       owner release prunes it.
CARRY: T1's face-frame query for the Wall-face reading (S02 shipped the hand-aligned upright sheet
       instead); battery-mode performance rows and the exhaustive browser matrix go to S03; the closing
       side-quad texture seam; the visitor /p first-load target stays a T4 hard row.
```
