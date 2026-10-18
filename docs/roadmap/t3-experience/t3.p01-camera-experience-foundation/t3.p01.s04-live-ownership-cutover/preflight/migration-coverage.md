# Migration and refusal coverage — plan

**Slice:** T3.P01.S04 · **Status:** draft preflight — **no fixture has been executed; not evidence**
**Source of truth for outcomes:** [phase conversion and refusal matrix](../../README.md#conversion-and-refusal-matrix)
**Depends on:** [inventory.md](./inventory.md) (the format buckets this plan must cover)

This plan maps every inventoried source format and source kind to a matrix row. It adds no new
conversion semantics: if a case is absent from the phase matrix, the correct outcome is a refusal,
not an invented conversion. It is a coverage **plan**; the fixtures below are named obligations, not
passing tests. The converter and its candidate semantics belong to T3.P01.S01's landed work; S04
executes them against inventoried data and must not add a second converter.

## Coverage rule

1. Every bucket produced by the inventory is covered by at least one **convert** fixture and, for each
   refusal class it can produce, one **refuse** fixture.
2. A bucket with zero inventoried rows still needs a fixture only when the matrix names it as admitted;
   otherwise it is recorded as `not inventoried — no coverage claimed`.
3. No fixture may be accepted from the current-source adapter; conversion is a distinct,
   read-only administrative entry. Ordinary readers must never sniff formats.
4. Source bytes are immutable inputs. Preparation and refusal leave them byte-identical.

## Format and source-kind ledger

Filled from the executed [inventory](./inventory.md). Until then every row is `not measured`.

| Source kind / format | Inventory count | Matrix rows that apply | Convert fixture | Refuse fixture | Status |
| --- | --- | --- | --- | --- | --- |
| Current strict root, empty project (no Camera/order) | not measured | Empty project | `empty-wraps-unchanged` | `unknown-source-format` (for an unknown root key) | planned |
| Current strict root, free-only Camera node | not measured | Valid free-only node | `free-only-becomes-view` | `unresolved-camera-target` | planned |
| Current strict root, reciprocal open chain | not measured | Valid reciprocal open chain | `open-chain-order-preserved` | `asymmetric-links` | planned |
| Current strict root, multiple open components | not measured | Multiple open components | `two-components-two-guides` | `requires-policy-mapping` | planned |
| Current strict root, single residual cycle | not measured | Single admitted residual cycle | `two-node-pair-is-not-a-loop`, `distinct-closing-loop` | `malformed-source` (a cycle with no closing connection) | planned |
| Current strict root, `detourOfNodeId` (incl. singleton) | not measured | Detour | `singleton-detour-return` | `ambiguous-detour-origin` | planned |
| Current strict root, `lockInteraction` true | not measured | Locked node | `locked-node-reviewed-policy` | `locked-entry-policy-missing` | planned |
| Current strict root, `lockInteraction` absent/false | not measured | No-op lock row | `lock-absent-copy` | — (no refusal; the matrix row is a no-op) | planned |
| Current strict root, nonzero connection View-key hold | not measured | Connection View-key hold | `connection-hold-explicit-use` | `requires-policy-mapping` (hold direction unknown) | planned |
| Current strict root, paths/keys/envelopes/timing | not measured | Paths/keys/envelopes | `camera-parity-probe` | `malformed-source` (anchor or timing cannot be read) | planned |
| Current strict root, missing external pin/binding | not measured | Missing external asset pin | `unresolved-pin-preserved` (repairable) | `malformed-source` (a binding that is structurally invalid) | planned |
| Current strict root, duplicate IDs / malformed lock / missing revision | not measured | Missing/invalid legacy node | — | `duplicate-identity`, `malformed-source`, `missing-revision` | planned |
| New F2 unit envelope | not measured | (no conversion) | `envelope-passthrough` — recognised and left untouched, **not** converted | `unsupported-source-version`, `unsupported-unit` | planned |
| Unknown / unsupported version or root | not measured | Missing/invalid legacy node | — | `unknown-source-format`, `unsupported-source-version` | planned |
| Portable package format (own header/version) | not measured | Phase note: package boundary | — | `unsupported-package-version` (until an explicit decision) | planned |

The entries above with **no convert fixture** are intentional: the matrix refuses them, and the
package format has no admitted new envelope yet. If the inventory finds any, activation stops for an
owner decision (see [owner-decisions.md](./owner-decisions.md)).

The ledger covers **source buckets**. The matrix's runtime rows — new reorder/duplicate/delete/entry
edit, Travel/Cut/keep-viewpoint, and failed staged upload/stale writer/late prior-run event — are
operation and runtime obligations of S04's exit criteria, not source-bucket coverage; they are not
silently treated as covered here.

## Refusal contract

A refusal is a reviewable result with an unchanged accepted state. It carries:

| Field | Contract |
| --- | --- |
| `code` | Stable machine code (kebab-case), from the closed set below; never a prose variant |
| `path` | JSON pointer into the offending source (e.g. `$.scene.navigationNodes[3].next`) |
| `action` | The repair or policy step the creator/owner must take |
| `message` | One sentence, no internal identifiers, no stack trace, no partial data |
| `retained` | Explicit statement that original bytes and any existing accepted revision are untouched |

Closed refusal set for this slice (extend only by a reviewed amendment to the phase matrix). Every
ledger refuse cell above uses exactly one of these codes, and no fixture may introduce another:

`unknown-source-format`, `unsupported-source-version`, `malformed-source`, `duplicate-identity`,
`asymmetric-links`, `missing-revision`, `unsupported-unit`, `requires-policy-mapping`,
`ambiguous-detour-origin`, `locked-entry-policy-missing`, `unresolved-camera-target`,
`unsupported-package-version`, `convertible-with-loss-not-approved`.

| Code | One message template |
| --- | --- |
| `unknown-source-format` | This source is not a format this editor can read. |
| `unsupported-source-version` | This source uses format version {version}, which this build cannot convert. |
| `malformed-source` | This source is damaged at {path}. |
| `duplicate-identity` | Two items share the identity {id}. |
| `asymmetric-links` | The order links at {path} disagree about their neighbour. |
| `missing-revision` | This source has no revision to preserve. |
| `unsupported-unit` | The unit at {path} is not supported by this build. |
| `requires-policy-mapping` | This source needs an owner policy decision before conversion. |
| `ambiguous-detour-origin` | The detour at {path} does not name one origin. |
| `locked-entry-policy-missing` | The locked entry at {path} has no approved startup policy. |
| `unresolved-camera-target` | The camera target at {path} could not be resolved. |
| `unsupported-package-version` | This package version is not supported. |
| `convertible-with-loss-not-approved` | Conversion would drop authored data at {path} and is not approved. |

`convertible-with-loss-not-approved` exists so a converter can disclose a lossy case instead of
silently choosing. It is not a licence to drop authored data.

### Message contract

- A refusal names what could not be converted and what the owner can do next; it never says
  "invalid project" alone.
- A refusal never reports success partially: no version, no publication, no staged pointer changes.
- A repairable authored binding (`unresolved-camera-target`) may install as an explicit unresolved
  binding only when the target kind permits it; required runtime closure still refuses publication.
- Refusals are logged with the same code/path in server logs and the mapping report, so review can
  match a user report to a fixture.

## Fixture plan

Each fixture is a committed input pair (source JSON + expected candidate/report) with three
assertions:

1. **Determinism** — running conversion twice on the same captured bytes produces byte-identical
   candidates and an identical mapping report.
2. **Immutability** — the input file hash is unchanged after both a successful conversion and a
   refusal.
3. **No partial install** — a failure injected at planning, staging or CAS leaves revision, lock,
   history and publications unchanged.

Fixture homes: the S01 converter's existing conformance suite under
`packages/project-model/src/units` and its test directory; the S04 integration suite adds only the
inventoried-bucket end-to-end cases. No phase-local copy of an S01 assertion is created. The exact
fixture filenames are fixed at coverage review, when the inventory says which buckets actually exist;
this plan names the cases, not invented paths.

Required cases beyond the ledger:

- mixed old/new roots in one database (must be handled one project at a time, never as a batch
  reinterpretation);
- a project whose `latest_version` is newer than its highest stored version (corrupt pointer);
- a `publications.active_version` with no matching `releases` row;
- a release whose manifest is not an object;
- an asset `object_key` present in SQL but absent from the bucket, and the reverse;
- the two-node pair sole edge (explicitly **not** a loop);
- a lock=true node reached at startup and reached by incoming traversal (separate assertions).

## What this plan does not claim

- It does not claim the converter covers historical room-local Scene/Layout generations, external
  frozen projects or old public releases. Those are outside the proposed migration exception and are
  refused.
- It does not claim any fixture passes. Nothing here is acceptance evidence.
- It does not approve a lossy conversion. Any loss needs its own owner decision.

## Review checklist

- [ ] Every inventory bucket appears exactly once in the ledger.
- [ ] Every matrix row with a convert outcome has a convert fixture; every refuse outcome has a refuse
      fixture.
- [ ] No fixture asserts `convertible-with-loss-not-approved` as a success.
- [ ] Fixture inputs are real captured shapes, reviewed for PII before commit.
- [ ] Every ledger refuse cell uses a code from the closed set, and each code has one message
      template.
