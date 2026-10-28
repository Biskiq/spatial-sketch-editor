# T5.P01.S04 — My Objects: save and insert editable copies: implementation plan

**Slice:** T5.P01.S04 · **Status:** proposed. It is completed and approved after `T5.P01.S01` is
accepted and T2 agrees the library-scope design (decision D8 in the
[record](../../../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-decisions));
it may run beside S02 · **Phase:** [T5.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T5](../../README.md) · **Direction:**
[umbrella plan](../../umbrella-plan.md) · **Runbook:**
[T5 operations](../../../../operations/t5-expressive-geometry/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t5.p01.s03-integrated-final-gate/acceptance.md
```

## 1. Outcome

The owner-committed workflow ([amendment](../../../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-reusable-native-objects)):
**Save to My Objects → open another project → insert an editable copy → refine independently.**

A creator selects a native form and saves it to **My Objects**. In any of their projects they open
My Objects, insert the form, and get an ordinary native form placed on the floor with the saved
source exactly — controls, keys and scale — which they then refine like any other form. The copy and
the saved item never affect each other, and both survive Save, reopen and new sessions.

## 2. Why this is the smallest sensible slice

- **One kind, one scope.** It lands the ratified library scope of the one typed resource system for
  the `form` kind only, rather than a general library, a second store or a per-feature cache.
- **Detached copies.** Inserting creates a new authored identity, as the
  [assets destination](../../../../reference/components/assets.md#ratified-destination-not-shipped)
  requires for independent editing. The project gains no resource, lock entry or reference, so no
  F1 lifetime, retention coupling or update semantics are needed.
- **Three operations.** Save, list-and-insert, and remove. Remove keeps owner data deletable,
  without which a bounded library would dead-end.
- **Deferred:** shared instances, offered updates, item revisions, rename, folders, search,
  thumbnails stored on the server, sharing between owners, and other resource kinds.

## 3. Dependencies

- `T5.P01.S01` accepted: the form source, its strict codec, geometry-core validation, contact and
  footprint.
- T2's agreement on the library-scope design (D8), and T2 review of every resource, API and Scene
  change.
- An API migration slot serialized with other `apps/api` writers under the
  [shared-file protocol](../../../cross-track-execution.md#shared-files-and-merge-protocol).
- Not S02: S04's planners and API are independent of the Ink seam. The creator journey that draws a
  form, saves it and reuses it is proven in the final gate, after S02.

## 4. Design

### 4.1 Library item (typed resource, library scope)

- **Payload, format 1:** `{ formatVersion: 1, kind: 'form', name, form, materialId, castShadow,
  receiveShadow }`. `form` is the Scene form source exactly as S01 defines it. `materialId` is a
  catalogue material; a project's material-instance override does not travel, because it names
  project-local data.
- **Codec.** A strict reader and canonical writer in `@portfolio/project-model`, reusing S01's form
  codec and geometry-core validation, used by both the editor and the API. The payload refuses
  unknown keys and other format numbers. When the Scene form encoding changes (for example when P02
  adds operations), this format moves with it.
- **Format changes.** Stored items are a named pre-baseline exception
  ([obligation](../../../../reference/decisions/t5-object-focus-planning-2026-10-27.md#owner-amendment-reusable-native-objects)): the slice that moves this format ships an upgrader and a scripted migration
  that carries every stored item forward with its meaning unchanged, while live readers stay strict.
  S04 ships format 1, so it has no upgrader; it records each item's format number and commits the
  corpus the first upgrade must carry.
- **Identity:** a server-allocated logical id and one immutable revision whose content identity is
  `sha256Bytes` of the canonical bytes, as for T2's resource pins. Each Save creates a new item;
  creators never edit items in place. The only rewrite is a scripted format migration, which keeps
  the logical id and recomputes the content id.
- **Ownership:** an item belongs to the signed-in owner. Only that owner lists, reads, inserts from
  or removes it. Items are not project data: deleting a project leaves them, and no project, release
  or visitor route can read them.
- **Bounds:** at most 256 KiB of canonical bytes per item and 1,000 items per owner. A full library
  refuses Save in words and points to Remove.

### 4.2 API

- A migration adds owner-scoped library storage: the logical id, owner, kind, name, format
  number, content id, canonical bytes and creation time, plus empty prior-bytes and prior-content-id
  fields for a future format migration's recovery. Small payloads live in the database, not the
  object store.
- Owner-only routes: create (validates through the shared codec, recomputes the content id and
  refuses a mismatch), list (id, name, kind, content id and created time), read (canonical bytes,
  cacheable by content id) and remove.
- A request for another owner's item answers as not found. No route is reachable without the
  existing authentication.

### 4.3 Save to My Objects

- A Card action on one selected form. It reads the form from the **accepted** source — never a
  pending preview — proposes the entity's name, and posts the canonical payload.
- Save is outside authoring history, like T2's acquisition and approval: it adds no history entry
  and does not make the project dirty. A cancelled, failed or stale request stores nothing, and the
  creator sees the outcome in words.

### 4.4 Insert an editable copy

- My Objects appears as a section of the existing object-placement surface, listing the owner's
  items by name with a footprint silhouette derived on demand from the source and never stored. The
  list loads lazily when the section opens.
- Choosing an item fetches its bytes, checks the content id, parses with the strict codec, and enters
  the existing floor-placement interaction, previewing the evaluated form.
- Placing issues a new Scene intent, `place-form-copy` (Scene admission only, no resources). Its
  payload carries the complete parsed item, the World position and yaw, and the captured support
  evidence. The planner re-validates, allocates a new entity id, writes `form` verbatim (keys, scale
  and `nextKey` included), sets rotation `[0, yaw, 0]`, rests the body on its support using the
  form's contact, and returns one accepted result. Undo removes the copy.
- The copy records no reference to the item. Refining it uses the operations available in the
  product at the time: move, turn, place on floor, duplicate and delete from S01, size from S02, and
  Object Focus from P02.

### 4.5 Remove from My Objects

Removing an item deletes its storage after a confirmation. Copies already inserted are unaffected,
because they hold their own source.

### 4.6 Boundaries

The library client, Save action and My Objects section are editor-only and lazily loaded; visitor
and publication paths cannot import or reach them. No F, Head, Save, Camera, PLATE or Stage-host
change is planned.

## 5. Tests and acceptance criteria

The integration criteria in the [umbrella plan §7.2](../../umbrella-plan.md#72-what-must-be-proven)
apply. This slice must prove cross-project reuse and Save/reopen:

1. **Save.** From project A, saving a form with smooth anchors and a non-default scale stores one
   item whose `form` equals A's accepted entity source exactly and whose content id matches its
   bytes. Save adds no history entry and leaves A clean.
2. **Cross-project insert.** In project B of the same owner, the item is listed. Inserting it
   creates exactly one form entity with a new id, whose `form` is identical to the item's (keys,
   scale, `nextKey`) and whose golden digest equals A's original. It is one history entry; Undo and
   Redo are exact.
3. **Independence.** Refining the copy in B leaves the item's content id and A's entity unchanged.
   Refining A's original leaves the item and B's copy unchanged. Two insertions of one item are two
   independent entities.
4. **Save and reopen.** Saving B and cold-reopening it in a fresh session reproduces the copy's
   source and digest exactly, and B contains no resource, lock entry or reference for the item.
   A reopens unchanged. My Objects lists the item in a new session after signing in again.
5. **Lifecycle.** Deleting project A leaves the item and B's copy intact. Removing the item leaves
   B's copy intact, and B still opens and saves.
6. **Refusals.** Another owner cannot list, read, insert from or remove the item. Malformed,
   oversize, wrong-format and content-id-mismatched payloads store nothing. A cancelled or failed
   Save stores nothing. An item that fails parsing or validation refuses at insertion and adds no
   history. A full library refuses Save in words.
7. **Isolation.** The architecture lane passes, including visitor isolation, and publication is
   unchanged.
8. **Verification.** The complete merge-gate contract per
   [tests/README](../../../../../apps/editor/tests/README.md), including `check:api` and a
   DB-backed `test:api` with zero skips over the migration and routes, and agent E2E covering
   journeys 1–5 across two projects.
9. **Performance.** Insert commit, Undo and Redo ≤ 100 ms; opening My Objects with 100 items
   produces no main-thread task over 50 ms; Stage first-load growth ≤ 25 KiB br (the library code is
   lazy). Measured as for S01.
10. **References.** The [assets](../../../../reference/components/assets.md) contract records the
    landed library scope for the `form` kind, [persistence](../../../../reference/components/persistence.md)
    records the library storage, and [Scene content](../../../../reference/components/scene-content.md)
    records `place-form-copy`, in the same PR.
11. **Format record.** Every stored item records its format number, and the slice commits a
    format-1 item corpus — both planes, smooth anchors, limit values and non-default scale — as the
    covered-data fixture that the first format migration must carry forward.

## 6. Reviews and stop conditions

- **Reviews:** T2 for the library scope, codec, API, migration and Scene intent; T3 only if Save,
  Head or project lifecycle code changes, which this plan does not expect; an independent code
  review before merge.
- **Stop and report if:** T2 does not agree the library-scope design; a project-side resource,
  lock entry or reference appears necessary; an F, Head or Save change appears necessary; a
  dependency appears necessary; or a hard performance row misses.

## 7. Handoff

The final gate runs the full creator journey after S02: draw a form in project A, save it to My
Objects, open project B, insert it, refine it, and Save and reopen both. P02 inherits the library
payload, whose format follows the Scene form encoding, together with the obligation to migrate stored
items when that format moves, starting from this slice's format-1 corpus.
