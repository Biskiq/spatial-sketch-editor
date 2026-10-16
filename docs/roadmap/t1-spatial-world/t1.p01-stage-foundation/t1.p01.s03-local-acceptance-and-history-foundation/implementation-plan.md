# T1.P01.S03 — implementation plan — CLOSED STUB

```text
AUTHORITY: NONE — this slice is closed. Current status is in the phase README's slice register.
ROLE:      historical route to the accepted scope and criteria; no authority for new work.
STATUS:    shipped 2026-10-16; plan body compacted by `slice-closeout`.
ACCEPTED:  `F4.intent-acceptance@1:acceptance-invariants-v1` and
           `F4.intent-acceptance@1:local-single-domain-v1`.
RECOVERY:  git show 8ec0c5f15126190863d1f6db2220e2487bf7d7f6:docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s03-local-acceptance-and-history-foundation/implementation-plan.md
```

The accepted criteria, source boundaries and residuals are summarized in the routed [acceptance
record](./acceptance.md) and the two [capability records](./capability-acceptance-invariants-v1.md),
[local single-domain](./capability-local-single-domain-v1.md). F.4 remains defined by
[AM-4](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1).

## Content identity

The accepted source-content digest hashes canonical authored bytes with ID-keyed Layout identity
maps ordered and only `layout.identity.cursor` excluded. Full canonical source retains the cursor
for exact persistence/history restoration. The digest is invariant to input key order and whitespace;
cursor-only changes are no-ops, and Undo to identical authored content restores the digest under a
fresh revision. See the durable F.4 contract at
[AM-4](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1)
and the [accepted local capability](./capability-local-single-domain-v1.md).
