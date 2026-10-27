# T2.P02.S03 — Stage delivery-budget amendment proposal

```text
AUTHORITY: NONE — the owner owns the hard budget. This artifact proposes an amendment and the
evidence for it; it waives nothing, accepts nothing and changes no status by itself.
ROW:       performance.md §Budgets — Delivery: Stage route first-load JS (br, cold) ≤ 400 KiB (Hard)
REVISION:  8cb97fe8, on integrated main through the T1 #201 merge
REQUEST:   raise the Stage hard budget from 400 to 425 KiB br JS, or record a different ruling
```

## Measured result

The production build at `8cb97fe8` reports, from `npm run perf:bundle`:

```text
/project/[projectId]/spatial
  js    raw 1758.7 KiB | gzip 501.2 KiB | br 422.4 KiB
  all   raw 1791.9 KiB | gzip 508.3 KiB | br 428.5 KiB
```

The row measures JS, so the miss is **22.4 KiB**, not 34.3. At `7d1212b6` the same report measured
**456.7 KiB** JS; the two on-demand splits below account for the reduction, and no measured row
improved because of a removed capability. The model-renderer split is editor-only: the public
visitor keeps its static renderer, and the Stage bundle is unchanged by that isolation.

## What was removed from the first-load graph, and what remains

Measured, not inferred:

| Change | Effect |
| --- | --- |
| Import procedure (session, worker client, digest) loaded on first open | one lazy chunk; the Stage route no longer serves it |
| Model renderer (`AssetModel`, glTF loader, meshopt, skeletal cloning) loaded at idle in the editor Stage | one lazy editor chunk; models still present on the first frame that draws them. The public visitor keeps the static import, so its graph is unchanged. |
| Import hashing taken out of the glTF-Transform pipeline (7d1212b6) | worker-only ingest, no route bytes |

The remaining first-load chunks, attributed by chunk content from the same build:

| Content | br | Why it is in the first interactive frame |
| --- | --- | --- |
| `three` core | 152.1 KiB | The one persistent Canvas renders the Plan and 3D readings; the product has no second renderer. |
| Stage route, shell, adapters, `project-model` | 126.2 KiB | The editor screen, its Index/Card/dock/instrument surfaces, admission and the F4 acceptance path. |
| `layout-core` + `camera-core` | 58.8 KiB | Plan compile, floor support, projection and picking for the first frame. |
| Museum renderers, materials, scene-instance painting | 30.2 KiB | The first architectural frame itself. |
| Svelte runtime, Threlte Canvas, small chunks | 55.2 KiB | The framework and Canvas host. |

The remainder is not one optional feature. The Experience lens and the task instruments are
reachable from the first screen; the model renderer and Import are already out. Lazy-loading the
Experience surface or every instrument would trade a first-paint byte count for a fetch on a UI
action, and would not recover 22.4 KiB with any confidence — the earlier review found that the only
remaining large chunks are the renderer, the authoring graph and the compiler.

## Why the 400 KiB figure no longer describes this product

The 400 KiB row was ratified on 2026-10-22, before the T1 shell and T2 model import were integrated.
At this revision the Stage is a full authoring surface: one Canvas with Plan/3D, canonical
admission/acceptance, Layout compile and picking, the shell, and approved-model rendering. The
measured essential set is **≈422.4 KiB**; the gap to 400 is not an identified capability that can be
deferred without changing the first interactive frame the contract itself requires (S: ≤3.0 s cold).

Splitting the remaining UI surfaces would be an architectural contortion for a number: it would
degrade task entry to an asynchronous panel and still leave the renderer and compiler in the first
load.

## Recommendation

**Raise the hard row to ≤ 425 KiB br JS**, keeping the existing rule that a slice may not grow the
route by more than 25 KiB br without a recorded reason. Under that amendment, `8cb97fe8` passes at
422.4 KiB with 2.6 KiB headroom, and the next delivery change must either fit or bring its own
recorded reason.

Alternative: **≤ 450 KiB** gives 27.6 KiB durable headroom, at the cost of allowing a further ~25 KiB
of first-load growth before the row binds again. It is the safer planning number but a weaker
budget; the measured floor does not require it today.

Either ruling must be explicit and recorded in [performance.md](../../../../reference/components/performance.md);
this proposal does not amend the contract.
