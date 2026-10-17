# Publication compatibility disposition (AM-7, K2)

**Slice:** T3.P01.S04 · **Status:** draft — **awaiting owner approval; no disposition is approved**
**Evidence:** [inventory.md](./inventory.md) (publication and release rows) ·
**Rulings:** R1-D and K2 of the [2026-10-17 decision](../../../../../reference/decisions/next-batch-authorization-2026-10-17.md)

This file frames the decisions, not the outcome. No existing publication has been inventoried yet, and
the phase rule is explicit: there is **no blanket approval** for a publication gap. Temporary
unavailability is accepted in principle (K2); the actual gap is approved only here, only after the
live inventory and compatibility review.

## What changes at cutover

The source format changes once. Production publication today serves authored-snapshot documents
through the P22 reader; the phase retires that path at the T4 prepared-reader cutover and does **not**
convert public release artifacts during S04. Therefore every existing publication has exactly one of
three dispositions:

| Disposition | Meaning | Requires |
| --- | --- | --- |
| **Compatible** | The stored release artifact is readable by the post-cutover readers without conversion | A verified reader probe on the actual artifact; today this is not expected for any current-source release |
| **Needs conversion** | The release can be converted by a bounded, reviewed converter with no authored loss | A conversion decision, fixtures, and a delivery barrier; not part of S04's source-only converter by default |
| **Temporary gap** | The publication stays stored but cannot be served until T4's prepared-reader cutover | Owner approval of the concrete list and the honest unavailable behaviour; no data deletion |

There is no fourth "keep the old engine running" option: the phase forbids a competing old visitor
engine. A per-publication artifact must be classified from its actual stored bytes, never from the
project's source format.

## Disposition table

Filled only from the inventoried publication rows. Until then, every row is `not measured`.

| Public ID | Project | Active version | Release manifest valid | Artifact readable post-cutover | Disposition | Owner approval |
| --- | --- | --- | --- | --- | --- | --- |
| not measured — requires read-only production access | — | — | — | — | undecided | — |

If the inventory returns zero publication rows, the table is replaced by the measured zero and the
decision below becomes the empty-release gap decision. A measured zero is still an owner decision, not
an automatic approval.

## Required behaviour during any approved gap

Public and owner routes must be honest throughout. No route may return a blank page, a 200 with an
empty viewer, or a silent redirect that looks like success.

| Route / action | During gap | Never |
| --- | --- | --- |
| Cold public read of a published project | Explicit `410`/`404`-class unavailable outcome with a human message ("This experience is temporarily unavailable while publishing is upgraded") and the real `/p/` route preserved | 200 with empty content; old reader fallback; silent redirect to the editor |
| Owner status read | Reports the true stored state: publication exists, `active_version`, revision, and `unavailable until prepared delivery` | Reporting "unpublished" or "not found" when a publication row exists |
| Owner Unpublish | Works; clears `active_version` and reports success | Blocked by the gap; deleting releases |
| Owner Publish / Update | Typed `prepared-reader-required` refusal with the reason and no partial write | Accepting a publication that cannot be served; overwriting an existing release |
| Direct artifact URL | Not served by an old reader | Serving an unconverted artifact through a compatibility shim |

`/p/` boundary tests stay real: the route exists, returns the unavailable outcome, and leaks no editor
machinery. Identity isolation and cold/public boundary suites remain unconditional.

## K2 — the publication-gap decision

**Decision owner:** the repository owner. **When:** only at T3.P01.S04 authorization, after the
inventory and compatibility review. **Status:** open. The principle is accepted; the gap is not.

### Option A — approve a gap bounded by the measured publication set (recommended if the set is small)

- Scope: the exact inventoried publications, listed by public ID and active version.
- Behaviour: the table above, until T4's prepared-reader cutover.
- Consequences: public links for those projects are unavailable for the duration; owners keep status
  and Unpublish; new Publish/Update refuses with `prepared-reader-required`.
- End condition: T4.P01.S05's prepared-reader cutover, which follows
  [Core Editor Stability](../../../../core-editor-stability.md) under R1-D.
- Recommended when the measured set is small. It is honest and compatible with the phase's "no
  competing old visitor engine" rule; Options C and D are equally honest and differ in scope, not in
  honesty.

### Option B — require conversion of existing publications before activation

- Scope: convert each inventoried release artifact to a prepared form S04 can serve.
- Consequences: S04 grows a release-artifact converter and a delivery barrier; scope, risk and
  timeline expand materially, and the converter must not become a permanent dual reader. It also
  front-runs T4's prepared-envelope work (F5 is `undrafted` and deferred).
- Use only if the owner judges unavailable public links unacceptable. It is a scope change requiring a
  new plan and authorization, not a variant of S04.

### Option C — measured-zero gap (only if the inventory proves zero publications)

- Scope: no existing publications; the gap is prospective only.
- Behaviour: new Publish/Update returns `prepared-reader-required`; public cold boot returns the
  explicit unavailable/not-found outcome; status/Unpublish stay honest; `/p/` stays real.
- Consequences: no existing audience is affected; the first real publication waits for T4.
- This still needs an owner decision record; "zero" is a measured fact, not an approval.

### Option D — no gap (reject activation now)

- Stop S04. Keep the current source and publication path until a prepared reader exists.
- Consequence: the whole cutover, and everything downstream that consumes
  `T3.camera-experience-cutover@1`, waits. This is a legitimate choice, not a failure.

## Recommendation

If the inventory finds **zero** publication rows: Option C, with an explicit measured-zero record.
If it finds a **small, fixed** set: Option A, listed per publication. If it finds a **large or
business-critical** set: escalate to Option B with a revised scope, because silently darkening many
public links is not a routine disposition.

No option is applied by this document. The coordinator escalates this decision with the executed
inventory attached.

## Drift note

The phase plan's authorization-path item 4 says the disposition belongs in `preflight/` "plus the
authorization record". No authorization record exists yet; this file must stay marked awaiting
approval, and the eventual decision record must cite the executed inventory hash.

A gap for a **non-zero** publication set is not a routine disposition: it amends the phase README's
stricter rule that covered releases without an approved compatibility disposition block activation
(and the "stop activation until T4/owner settles conversion/compatibility and barrier sequencing"
reading). It therefore needs an owner-ratified amendment alongside the disposition, not just a row in
this table.
