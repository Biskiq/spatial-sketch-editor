# Historical evidence

This is an opt-in evidence collection, not a product specification, workflow or status store.
Start with the [documentation router](../README.md); use history only for a concrete evidence question.
Git and pull-request history retain deleted authorization records, completed plans and prior contracts.

## Retention purposes

| Evidence family | Concrete purpose |
| --- | --- |
| [Core Product Stability owner acceptance](./roadmap/r217-core-editor-stability/r217.s11-integrated-final-gate/acceptance.md) | Owner hands-on acceptance at #271 (`ce4e232c`) and waiver of separate S11 execution; unexecuted checks remain unexecuted. |
| [R217 evidence](./roadmap/r217-core-editor-stability/) | Actual browser observations, reference specimens, tested revisions, reproduction recipes and disclosed limits. Old execution instructions are historical inputs, never future prerequisites. |
| [Closed capability evidence](./roadmap/closed-phases/) | Actual tests, fixtures, experimental findings and bounded acceptance observations whose useful failures must not be lost. Old phase registers confer no capability status. |
| [Prototype evidence](./prototypes/) | Runnable regression donor, accepted design specimens and unique interaction findings. A mock evaluator, data model or history mechanism is never a production contract. |
| [Technical investigations](./technical/) and [geometry/identity research](./roadmap/p23/foundation-research/) | Counterexamples, mathematical findings, numerical tolerances, independent oracles and implementation evidence. |
| [Fixed comparison captures](./roadmap/p25-experience/p25-unified-design/) | Byte-preserved comparator JSON where a separate comparison names the baseline. |

Retain source revisions, environment, methods, raw observations, fixtures, expected failures and
limitations needed to interpret these artifacts. A deterministic generated intermediate need not
survive merely because it once accompanied a run; a non-reproducible historical observation may.
Keep assets/tests with an executable. Unsupported or unrun cases never become passes by retention.

## Recovery

Use `git log --all -- <path>` and `git show <revision>:<path>` to recover a removed file.
The pre-reset repository is `e90a58224443bdbf44114d7285d55c983b79cc84`; the pre-final-prune
#259 tree is `5d7d7f3e679f79360c2a5bfb21814f45d4b49d75`. No replacement stubs are required.
Historical paths quoted inside evidence describe the recorded tree, not today's public routes.

References own enduring rules. Approved UX owns its approved target scope; experiments supply
supporting or challenging evidence, not a competing authority. Archive only material with an
identifiable retention purpose; prior approval or age alone is insufficient.
