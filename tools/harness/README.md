# Capability evidence harness

`npm run status` reports capability maturity and health against the actual remote `main` head,
plus live capability-linked flags and claims. It prints tested revision, source, timestamp and
suite completeness. Missing, stale or incomplete evidence is unknown; owner acceptance of a
product milestone is independent of automated evidence availability.

## Definitions and evidence

`capabilities.json` defines stable capability ids, North Star anchors and scoped surface paths.
Tests carry `<capability-id> <core|edge>` tags. Core checks establish a useful journey; edge checks
exercise additional cases. A capability needs a nonempty passing core set to become working.
Maturity and health are independent: an open confirmed defect can degrade a working capability,
and a core-blocking defect is explicit through `blocks-core`. Skips are not passes. Expected-failure
reproducers remain linked to their bug and cannot manufacture a healthy result.

Owner design review can establish polished maturity only with reviewed implementation and design
identity. Changes in the declared surface invalidate review; unrelated changes do not. Regression
comparison uses complete ancestor reports, not arbitrary local snapshots. Historical issue snapshots
remain historical while current flags and claims are fetched live.

## Gate and commands

The unconditional Merge gate workflow executes the complete suite contract, produces per-suite
provenance and aggregates only matching complete artifacts. The [test contract](../../apps/editor/tests/README.md)
owns required commands; root editor commands do not substitute for API or package checks.

- `npm run status`: inspect current evidence, claims, flags, focus and holds.
- `npm run gate:produce -- --suite <command> --artifact-dir <directory>`: run one declared suite and
  capture its tested revision and result.
- `npm run gate:aggregate`: aggregate suite evidence; see the CLI's required arguments in
  `aggregate.mjs` and the workflow invocation.
- `npm run gate:guards`: enforce check identities and confirmed bug-state protections.

The default-branch ruleset requires the stable `merge gate`, `check guards` and `linux-x64`
contexts. An integration run for a pull request is not a main push report. Until a complete report
exists for the actual main head, status remains unknown. Issue guards activate from the default
branch. No live incident, review or claim demonstration should be fabricated to improve a report.

## Work

The [workflow](../../docs/workflow.md) owns claims, flags, risk tiers and review. Claim by a draft PR
or self-assigned issue naming the capability, checking collisions before and immediately after.
A flag uses a capability label and its appropriate bug/decision/UX/research/ambiguity label.
The owner starts work by prompt; no scheduled agent is implied. Tests and code own harness
mechanics; this guide is usage documentation, not a second status store.
