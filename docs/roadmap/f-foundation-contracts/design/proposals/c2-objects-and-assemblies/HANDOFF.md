# Objects & Assemblies — design handoff

**2026-09-27 · Complete prototype for owner review; unratified proposal.**
This delivers Commission 2's interaction specimen. It ships no product feature,
changes no foundation contract and closes no roadmap phase. No user study was
conducted; preference and comprehension claims remain hypotheses.

## Start here

Run the [README command](README.md#run), then open [the demo](index.html).
The dark presenter walks six resettable steps. **Set up step N** prepares all
earlier steps; **Do it** demonstrates a task using the product's actions.
Press **J** to hide the presenter when working in 3D. Reloading discards all work:
both projects and the library live only in memory.

| Review question | Direct specimen |
| --- | --- |
| What actually arrived? | [Structured import](index.html?state=intake-lamp), [flat import](index.html?state=intake-relief) |
| Will this affect one use or the shared definition? | [Contextual reach](index.html?state=reach&scenario=0), [definition bench](index.html?state=bench&scenario=0) |
| What survives returning from inspection? | [Separated parts](index.html?state=inspect&scenario=0) |
| Does preview change the resting pose? | [Articulation](index.html?state=preview&scenario=0), [reduced motion](index.html?state=preview&scenario=0&motion=reduced) |
| Is this a valid attachment? | [Refused location](index.html?state=hang-refused&scenario=0), [remove host](index.html?state=remove-wall&scenario=0) |
| What survives an offered revision? | [Comparison and repair](index.html?state=review&scenario=0), [stale acceptance](index.html?state=review-stale&scenario=0), [cancelled update](index.html?state=update-cancelled&scenario=0) |
| What does another project receive? | [Accept / pin / fork](index.html?state=lib-review&scenario=0), [library outage](index.html?state=lib-unavailable&scenario=0) |
| Does it remain usable at narrower density? | [Compact review](index.html?state=review&scenario=0&density=compact) at 1024 × 700 |

The [rationale](rationale.html) includes the annotated journey/state map,
terminology, scope/lifetime rules, two editing approaches, rejected alternatives,
proposed PLATE/P26 departures, and usability hypotheses. The
[specimens](specimens.html) collect reusable value, capability, relationship and
repair patterns, plus deliberately unimplemented unavailable-resource states.

## Implemented and simulated

| Surface | Real behavior in this prototype | Boundary of the demonstration |
| --- | --- | --- |
| Import | Capability disclosure, provenance, cancellation, definition plus optional first use | Two fixture manifests; no file parsing, ingestion or correspondence inference |
| Composition | Place/drag/nudge; reuse; independently configured instances; organizational groups; component selection | Fixed native shapes and declared lamp parts; no general model/mesh editor |
| Scope | This-use versus definition values, inherited provenance, reach preview, retained compatible overrides, reversible bench draft | Small fixture-specific value model; no shared persisted channel API |
| Inspection | Exploded presentation, selection back to declared parts, accepted value edits, return summary | Mock display separation; no proof of arbitrary inverse transforms |
| Preview | Bounded arm pose, play/pause/reset/end, explicit keep-pose action; static range ghosts with reduced motion | Fixture evaluator and local viewing controller; production must use domain evaluation and canonical Camera authority |
| Architecture | Prepared bay, explicit wall attachment, validation/refusal, host motion, removed-host repair, exact keyboard placement | Toy bay representation only; not the production canonical Layout compiler or a geometry/constraint proof |
| Revision | Declared-ID comparison, reversible repair choices, detach, expected-revision refusal, one local Undo, reference diagnostics | Prepared source revisions and a simulated second writer; no importer identity matching, concurrent backend or generic merge |
| Reuse | Two separate projects; immutable in-memory library snapshots; offers, pin, fork, retained copy and outage | Simulated authorization/storage/network. Reference-only loading is disabled; missing-copy recovery is a static design specimen |

Snapshot history is a prototype mechanism. Publishing a simulated library revision
creates a library snapshot; project Undo restores the local project and does not
retract a library revision already offered to another project. No external data is
written. The UI's “saved” text is explicitly marked simulated.

## Semantic assumptions for a consuming plan

- Scene owns object composition and attachments. Architecture remains Layout;
  creating a group or definition never adopts the bay. Placement is world-local.
- Imported parts require declared identity. Render-mesh names/order supply no
  correspondence. Shade → Hood preserves `p.shade`; the removed Diffuser remains
  unresolved, even though a similarly named render mesh exists.
- Inspection displacement, preview output and hover reach are temporary. Only an
  explicit accepted edit changes a baseline. Preview Reset/End writes nothing.
- Revision repair choices remain reversible until acceptance. A stale attempt
  preserves the other writer's accepted rename. A compatible finish override
  survives; an out-of-range arm setting and a removed glass target remain distinct.
- Renaming or reshaping can require presentation review even when identity resolves.
  Camera/Experience reference records are read-only fixtures here.
- Pin retains identity and a revision offer; fork creates a new authored identity.
  Retained copies represent the same resource revision, not independent definitions.

These are interaction assumptions under the ratified F constraints, not proposed
production encodings. No prototype object layout is a schema recommendation.

## Findings to carry forward

| Creator problem | Prototype observation | Proposed consequence / owner | Remaining proof |
| --- | --- | --- | --- |
| Predict an edit's reach | Both approaches can preserve the second use's black finish while the definition changes; contextual reach keeps both uses visible | Show scope and effective impact before acceptance. Scene + F.3 | Compare wrong-scope edits with creators; the contextual default is a hypothesis |
| Reconsider a revision repair | Removing a resolved conflict from the comparison also removed the ability to change the decision; the repaired design retains its controls | Keep original conflict and current repair choice visible together. Scene/resources + F.1/F.4 | Real re-export with reordered/removed parts; compatible and incompatible overrides |
| Recover from a bad attachment | Refused window placement leaves source/history intact; exact fields provide a keyboard route to the same validation | Pointer and exact input must share domain validation. Scene/Layout + F.3/F.4 | Canonical/displayed frame correspondence, inverse edits, host invalidation and atomic acceptance through the real compiler |
| Open an important state directly | Framing before scene construction missed the subject; framing now resolves after display transforms exist | Direct specimen/inspection entry must frame the represented subject | Canonical Camera integration; do not copy this renderer's orbit interpolation |
| Reach controls at narrow density | The single-row instrument clipped Cancel; it now wraps | Preserve exit/accept actions before keeping one-row geometry. Proposed shell behavior | Ratify any production shell change through PLATE; broader responsive/accessibility testing |
| Keep editing through resource failure | A retained copy works without the simulated library; reference-only loading is honestly disabled | Disclose retention and support explicit missing/unauthorized outcomes. Resources + F.1/F.2 | Durable storage, access revocation, unavailable bytes, dependency locking and cross-project reuse |

## Verification

See [the verification record](qa/verification.md). Browser checks cover all six
presenter steps, thirteen named states, and source/history invariants. Manual
browser checks cover interaction wiring and desktop/compact presentation.

To rerun the prototype checks, open its browser console and run:

```js
await (await import('./qa/checks.js')).runChecks()
```

This resets the in-memory fixture. It is not a production test suite and does not
establish production geometry validity, importer fidelity, storage durability,
deterministic seeking, or visitor isolation.
