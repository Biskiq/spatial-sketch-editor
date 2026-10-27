# Native Form Lab model contract

This prototype keeps a small, serializable authored document. All geometric
lengths are SI metres; the world is Y-up. `Frame` is right-handed and
orthonormal (`normal = u × v`). Profile coordinates are local metres: x maps to
`frame.u`, y maps to `frame.v`; extrusion follows `frame.normal`. `FormOperation`
is the single discriminated operation union: extrusion carries its height,
revolve carries its angle in degrees, and sweep carries a keyed 3D carrier whose
`frameAnchor` orients the first profile section. Rounding carries a radius in
metres and an explicit corner policy.

`Profile.points` and `Profile.segments` are keyed independently. Each segment
names its `from` and `to` point IDs. Carrier points and segments use the same
addressing pattern. Array order expresses the current contour/path order, while
identity and relationships live in IDs; moving, reordering or reversing data
does not turn an array offset into an address. A carrier's `frameAnchorPointId`
names the fixed physical path point that owns its `frameAnchor`; reversing path
traversal preserves that point and frame, and evaluation starts from that same
anchor so geometry/orientation remain unchanged.

`LabDocument` contains only forms, attachments, finishes, format version and a
monotonic key allocator. It never contains generated meshes, camera/session
state, selection, or history. `roleKey({formId, partKey})` is the canonical JSON
encoding of that source address. A generated face is addressed only by the
owning form plus an authored part key, never by mesh index or proximity.
Profile segment faces use the segment's stable ID as their part key. Partial
revolve start/end caps use `revolveCapLifetimeKeys`; command transitions from a
full to partial turn allocate both keys. Reaching a full turn retires them, and
later becoming partial allocates fresh keys. Undo restores the earlier keys;
the document allocator itself remains monotonic and does not reuse keys.

Forms may be hosted on a generated planar role or a fixture plane. Attachments
are lightweight visual tokens with a target address, local metre anchor, and
last accepted world frame. `HostLink.lastFrame` records the previous host role
frame; while resolved, a host motion delta transports the child `Form.frame`,
preserving the child's relative placement. A target that splits,
retires or disappears leaves the
attachment or child host unresolved at its last frame; shrinking a target past
its anchor also leaves it unresolved. There is no silent nearest-face
reattachment or clamping. A user must call explicit repair. Paint is a
broadcastable authored role finish: when a profile segment is split, its finish
is copied to both descendant segment addresses. Undo restores the exact prior
addresses and finishes. When a point is removed and adjacent segments merge,
the incoming segment's finish wins on the new merged side (or the outgoing
finish if there was no incoming finish). Matching duplicate finishes collapse;
an incompatible secondary finish remains at its retired address with an
unresolved status and a diagnostic reason. Singular attachments to either
retired side remain unresolved at their last pose.

Anchor checks use `GeneratedRole.boundary` when supplied (a local planar
polygon), rather than relying only on its optional approximate `region` AABB.

Evaluation lives in `src/geometry/index.ts` and uses these fixed signatures:

```ts
evaluateForm(form: Form, document: LabDocument): FormEvaluation
evaluateDocument(document: LabDocument): DocumentEvaluation
```

Each evaluation returns plain numeric positions/indices, one semantic source
role key per triangle, semantic roles with optional planar anchor frames,
regions and bounds, and a stable typed refusal (`code` + `message`) on invalid
geometry. Invalid candidates are refused without altering authored state or
history.

The store in `src/model/store.ts` exposes `document`, `shownDocument`,
`subscribe`, `preview`, `commit`, `cancel`, `undo`, `redo`, `load` and
`serialize`; `deserialize` is a pure exported helper. Preview and commit run
the same document evaluator. One committed command is one undo step; previews,
refusals and cancel add no history. History is deliberately a simple in-memory
snapshot stack for this prototype, not a production history design.
The factory is `createFormLabStore(initial?: LabDocument, evaluator?:
DocumentEvaluator): FormLabStore`; each accepted preview/commit/load/cancel or
undo/redo state change synchronously notifies subscribers. Refusals do not
notify. `createLabDocument`, `createProfile` and `createCarrier` provide small
pure constructors for app setup and fixtures.

Supported commands are `addForm`, `removeForm`, `patchForm`,
`moveProfilePoint`, `insertProfilePoint`, `removeProfilePoint`,
`reverseCarrier`, `paint`, `attach`, `repairAttachment` and `repairChildHost`.
Removing a host never removes its child work. It marks affected links unresolved
and preserves their last frame. Removing a form also leaves its finishes
available only where authored source parts still exist; no generated artifact
is persisted.
