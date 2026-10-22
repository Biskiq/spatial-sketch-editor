# T2.P02.S01 — Model resource storage and admission: implementation plan

**Slice:** T2.P02.S01 · **Status:** approved — owner-authorized 2026-10-22 as batch E (E7,
[record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md)) and released from the
hold; started after `T3.P03.S01` merged on `main`; implemented 2026-10-22, evidence in
[acceptance.md](./acceptance.md) · **Phase:**
[T2.P02](../README.md) · [slice register](../README.md#slice-register) · **Runbook:** [T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p02.s03-integrated-final-gate/acceptance.md
```

Starts from a base where `T3.P03.S01` has merged; the phase's
[bounds](../README.md#upload-retention-and-derivative-bounds-owner-accepted-2026-10-22) are
owner-accepted. It gives the editor a trustworthy place to put a model and a source format that can name
it. It adds no editor UI.

## 1. API: staged, approved and immutable model revisions

- A new migration adds model storage beside the image asset registry rather than widening it: a staging
  record per import, owned by the project and session, with declared files, sizes and hashes; and an
  immutable approved revision with source file set, derivative, recipe and report digest. Existing
  texture assets and their tests are unchanged.
- Endpoints, all project-owner only: create staging; stream each file with server-side hashing and
  size limits, where a hash or size that differs from the declaration fails; cancel; and approve.
  Approve checks GLB/glTF structure (magic, version, chunk and buffer bounds, JSON parse, referenced
  files present) for source and derivative, then creates or reuses the content-addressed approved
  revision atomically and returns its pins. Unapproved staging expires, and its bytes are deleted.
- The owner-accepted bounds apply: a source file set of at most 50 MiB per import, a derivative of
  at most 25 MiB, deletion of unapproved staging and its bytes after 24 hours, and retention of an
  approved revision while any stored project version references it. The server checks structure only;
  it never produces or transforms a derivative.
- Object keys follow the existing project namespace. Approved bytes are served through the private
  content route as immutable, cacheable responses keyed by hash, so repeat loads in the editor and
  Preview hit the cache.
- Save verification: every `model` resource in a saved envelope must name an approved revision of
  that project whose hash, size and type match its pins; otherwise Save refuses with a typed reason
  and the project's stored version is unchanged. This removes the host-asserted gap for model
  resources; catalogue and texture resources keep their current rule.

## 2. Formats (number bump, strict refusal, no migration)

- Resources format: the `model` kind with derivative pin, source pin, recipe `{id, version}`, report
  digest and placement definition (metres per source unit, pivot, footprint, local contact; floor
  placement). Closure: a Scene model naming a `model` resource requires that entry and its lock.
- Scene format: a model names a catalogue asset or a `model` resource; the fallback gains a generic
  value drawn as the approved footprint box. No part fields; `componentId` stays null in every
  qualified reference.
- Admission in the editor (`apps/editor/src/lib/authoring/stage/source-admission.ts`) and the API
  accepts a model ID that resolves to a `model` resource in the same envelope. The visitor `/p`
  reader stays catalogue-only.
- The live host keeps refusing resource changes from any planner not granted resources. S02 adds the
  one granted placement planner; this slice adds the grant mechanism and its refusal tests only.

## Acceptance

1. **API (DB-backed, zero skips).** Owner-only access; a foreign or missing project refuses. A
   mismatched hash or size, an oversize file, a non-glTF file, a missing referenced file, and a
   derivative failing the structure check each refuse with nothing approved; a source set over 50 MiB
   or a derivative over 25 MiB refuses at its limit. Cancel and the 24-hour expiry delete staged bytes. Approving identical bytes twice yields one revision. Approved bytes never change.
2. **Save.** A model pin that is unknown, belongs to another project, is not approved or disagrees in
   hash, size or type refuses Save with no stored version change. A valid envelope saves and reloads
   byte-identically.
3. **Formats.** Old-number Scene and resources units refuse; strict readers reject unknown keys and
   part fields; a `model` resource without its lock, or a lock without its resource, refuses.
4. **No regression.** Catalogue and native placement, texture assets, conditional Save, conflict
   recovery and the visitor/public boundary suites stay green.

Verification: `npm run check:api` and the DB-backed `npm run test:api` with zero skips, the affected
project-model and Scene contracts, the arch lane and `npm run check`. The complete repository gate
runs before merge.
